-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Users table policies
-- Admins and coordinators can view all users
CREATE POLICY "Admins and coordinators can view all users"
  ON users FOR SELECT
  USING (get_user_role() IN ('admin', 'coordinator'));

-- Users can view their own record
CREATE POLICY "Users can view own record"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Only admins can update user roles
CREATE POLICY "Admins can update users"
  ON users FOR UPDATE
  USING (get_user_role() = 'admin');

-- Allow user creation (handled by trigger)
CREATE POLICY "Allow user creation"
  ON users FOR INSERT
  WITH CHECK (true);

-- Locations table policies
-- All authenticated non-pending users can view locations
CREATE POLICY "Authenticated users can view locations"
  ON locations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND get_user_role() != 'pending'
  );

-- Admins, coordinators, and editors can create locations
CREATE POLICY "Admins, coordinators, and editors can create locations"
  ON locations FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

-- Admins, coordinators, and editors can update locations
CREATE POLICY "Admins, coordinators, and editors can update locations"
  ON locations FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

-- Admins, coordinators, and editors can delete locations
CREATE POLICY "Admins, coordinators, and editors can delete locations"
  ON locations FOR DELETE
  USING (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

-- Categories table policies
-- All authenticated non-pending users can view categories
CREATE POLICY "Authenticated users can view categories"
  ON categories FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND get_user_role() != 'pending'
  );

-- Admins and coordinators can manage categories
CREATE POLICY "Admins and coordinators can create categories"
  ON categories FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'coordinator'));

CREATE POLICY "Admins and coordinators can update categories"
  ON categories FOR UPDATE
  USING (get_user_role() IN ('admin', 'coordinator'));

CREATE POLICY "Admins and coordinators can delete categories"
  ON categories FOR DELETE
  USING (get_user_role() IN ('admin', 'coordinator'));

-- Items table policies
-- All authenticated non-pending users can view items
CREATE POLICY "Authenticated users can view items"
  ON items FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND get_user_role() != 'pending'
  );

-- Admins, coordinators, and editors can create items
CREATE POLICY "Admins, coordinators, and editors can create items"
  ON items FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

-- Admins, coordinators, and editors can update items
CREATE POLICY "Admins, coordinators, and editors can update items"
  ON items FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

-- Admins, coordinators, and editors can delete items
CREATE POLICY "Admins, coordinators, and editors can delete items"
  ON items FOR DELETE
  USING (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

-- Item logs table policies
-- All authenticated non-pending users can view logs
CREATE POLICY "Authenticated users can view logs"
  ON item_logs FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND get_user_role() != 'pending'
  );

-- Only triggers can insert logs (via SECURITY DEFINER function)
-- No direct INSERT policy - logs are created via trigger

-- No one can update or delete logs (audit trail)
CREATE POLICY "No one can update logs"
  ON item_logs FOR UPDATE
  USING (false);

CREATE POLICY "No one can delete logs"
  ON item_logs FOR DELETE
  USING (false);
