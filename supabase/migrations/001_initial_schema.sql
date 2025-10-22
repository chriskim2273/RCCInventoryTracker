-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enums
CREATE TYPE user_role AS ENUM ('admin', 'coordinator', 'editor', 'viewer', 'pending');
CREATE TYPE log_action AS ENUM ('create', 'update', 'check_out', 'check_in', 'delete');

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Locations table (supports nested hierarchy)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  path TEXT, -- cached hierarchical path like "Center A / Room 1 / Shelf 2"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster nested queries
CREATE INDEX idx_locations_parent_id ON locations(parent_id);

-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Items table
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  is_unique BOOLEAN NOT NULL DEFAULT FALSE,
  checked_out_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  image_url TEXT, -- Supabase Storage URL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_items_category_id ON items(category_id);
CREATE INDEX idx_items_location_id ON items(location_id);
CREATE INDEX idx_items_checked_out_by ON items(checked_out_by);
CREATE INDEX idx_items_serial_number ON items(serial_number) WHERE serial_number IS NOT NULL;

-- Item logs table
CREATE TABLE item_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  action log_action NOT NULL,
  changes JSONB, -- stores old/new values for updates
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster log queries
CREATE INDEX idx_item_logs_item_id ON item_logs(item_id);
CREATE INDEX idx_item_logs_user_id ON item_logs(user_id);
CREATE INDEX idx_item_logs_timestamp ON item_logs(timestamp DESC);

-- Function to automatically create user entry on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'pending');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user entry on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update the path field when location changes
CREATE OR REPLACE FUNCTION update_location_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path = NEW.name;
  ELSE
    SELECT path INTO parent_path FROM locations WHERE id = NEW.parent_id;
    NEW.path = parent_path || ' / ' || NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update path before insert/update
CREATE TRIGGER set_location_path
  BEFORE INSERT OR UPDATE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION update_location_path();

-- Function to log item changes
CREATE OR REPLACE FUNCTION log_item_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  log_action log_action;
  change_data JSONB;
BEGIN
  -- Get current user from JWT
  current_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    log_action := 'create';
    change_data := jsonb_build_object('new', to_jsonb(NEW));

  ELSIF TG_OP = 'UPDATE' THEN
    -- Determine if it's a check-out or check-in
    IF OLD.checked_out_by IS NULL AND NEW.checked_out_by IS NOT NULL THEN
      log_action := 'check_out';
    ELSIF OLD.checked_out_by IS NOT NULL AND NEW.checked_out_by IS NULL THEN
      log_action := 'check_in';
    ELSE
      log_action := 'update';
    END IF;

    change_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));

  ELSIF TG_OP = 'DELETE' THEN
    log_action := 'delete';
    change_data := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  -- Insert log entry
  INSERT INTO item_logs (item_id, user_id, action, changes)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    current_user_id,
    log_action,
    change_data
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers to automatically log item changes
CREATE TRIGGER log_item_insert
  AFTER INSERT ON items
  FOR EACH ROW
  EXECUTE FUNCTION log_item_change();

CREATE TRIGGER log_item_update
  AFTER UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION log_item_change();

CREATE TRIGGER log_item_delete
  AFTER DELETE ON items
  FOR EACH ROW
  EXECUTE FUNCTION log_item_change();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on items
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
