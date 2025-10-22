-- IMPORTANT: Run this statement first, then run the rest of the file separately
-- Add coordinator role to existing user_role enum
ALTER TYPE user_role ADD VALUE 'coordinator';

-- Drop and recreate policies for users table
DROP POLICY IF EXISTS "Admins can view all users" ON users;
CREATE POLICY "Admins and coordinators can view all users"
  ON users FOR SELECT
  USING (get_user_role() IN ('admin', 'coordinator'));

-- Drop and recreate policies for locations table
DROP POLICY IF EXISTS "Admins and editors can create locations" ON locations;
DROP POLICY IF EXISTS "Admins and editors can update locations" ON locations;
DROP POLICY IF EXISTS "Admins and editors can delete locations" ON locations;

CREATE POLICY "Admins, coordinators, and editors can create locations"
  ON locations FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

CREATE POLICY "Admins, coordinators, and editors can update locations"
  ON locations FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

CREATE POLICY "Admins, coordinators, and editors can delete locations"
  ON locations FOR DELETE
  USING (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

-- Drop and recreate policies for categories table
DROP POLICY IF EXISTS "Admins can create categories" ON categories;
DROP POLICY IF EXISTS "Admins can update categories" ON categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;

CREATE POLICY "Admins and coordinators can create categories"
  ON categories FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'coordinator'));

CREATE POLICY "Admins and coordinators can update categories"
  ON categories FOR UPDATE
  USING (get_user_role() IN ('admin', 'coordinator'));

CREATE POLICY "Admins and coordinators can delete categories"
  ON categories FOR DELETE
  USING (get_user_role() IN ('admin', 'coordinator'));

-- Drop and recreate policies for items table
DROP POLICY IF EXISTS "Admins and editors can create items" ON items;
DROP POLICY IF EXISTS "Admins and editors can update items" ON items;
DROP POLICY IF EXISTS "Admins and editors can delete items" ON items;

CREATE POLICY "Admins, coordinators, and editors can create items"
  ON items FOR INSERT
  WITH CHECK (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

CREATE POLICY "Admins, coordinators, and editors can update items"
  ON items FOR UPDATE
  USING (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );

CREATE POLICY "Admins, coordinators, and editors can delete items"
  ON items FOR DELETE
  USING (
    get_user_role() IN ('admin', 'coordinator', 'editor')
  );
