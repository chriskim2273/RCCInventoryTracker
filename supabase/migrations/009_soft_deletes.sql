-- Add soft delete columns to main tables
ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id);

-- Create indexes for performance (querying non-deleted items)
CREATE INDEX IF NOT EXISTS idx_items_deleted_at ON items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_locations_deleted_at ON locations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_deleted_at ON categories(deleted_at) WHERE deleted_at IS NULL;

-- Add 'soft_delete' and 'restore' actions to the log_action enum
ALTER TYPE log_action ADD VALUE IF NOT EXISTS 'soft_delete';
ALTER TYPE log_action ADD VALUE IF NOT EXISTS 'restore';

-- Update the item change logging trigger to track soft deletes
CREATE OR REPLACE FUNCTION log_item_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  log_action log_action;
  change_data JSONB;
  skip_checkout_fields BOOLEAN;
BEGIN
  current_user_id := auth.uid();

  IF TG_OP = 'INSERT' THEN
    log_action := 'create';
    change_data := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if this is a soft delete or restore
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      log_action := 'soft_delete';
      change_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      log_action := 'restore';
      change_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSE
      -- Check if only checkout-related fields changed
      skip_checkout_fields := (
        OLD.name = NEW.name AND
        OLD.serial_number = NEW.serial_number AND
        OLD.quantity = NEW.quantity AND
        OLD.brand = NEW.brand AND
        OLD.description = NEW.description AND
        OLD.category_id = NEW.category_id AND
        OLD.location_id = NEW.location_id AND
        OLD.image_url = NEW.image_url
      );

      IF skip_checkout_fields THEN
        RETURN NEW;
      END IF;

      log_action := 'update';
      change_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- This shouldn't happen anymore with soft deletes, but keep for safety
    log_action := 'delete';
    change_data := jsonb_build_object('old', to_jsonb(OLD));

    INSERT INTO item_logs (item_id, user_id, action, changes)
    VALUES (OLD.id, current_user_id, log_action, change_data);

    RETURN OLD;
  END IF;

  INSERT INTO item_logs (item_id, user_id, action, changes)
  VALUES (COALESCE(NEW.id, OLD.id), current_user_id, log_action, change_data);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policies to exclude soft-deleted records by default

-- Items policies - update existing SELECT policies to exclude deleted items
DROP POLICY IF EXISTS "Viewers can view items" ON items;
CREATE POLICY "Viewers can view items"
ON items FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('viewer', 'editor', 'admin')
  )
);

-- Locations policies - update existing SELECT policies to exclude deleted locations
DROP POLICY IF EXISTS "Viewers can view locations" ON locations;
CREATE POLICY "Viewers can view locations"
ON locations FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('viewer', 'editor', 'admin')
  )
);

-- Categories policies - update existing SELECT policies to exclude deleted categories
DROP POLICY IF EXISTS "Viewers can view categories" ON categories;
CREATE POLICY "Viewers can view categories"
ON categories FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('viewer', 'editor', 'admin')
  )
);

-- Add new policies for admins to view deleted items
CREATE POLICY "Admins can view deleted items"
ON items FOR SELECT
TO authenticated
USING (
  deleted_at IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can view deleted locations"
ON locations FOR SELECT
TO authenticated
USING (
  deleted_at IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can view deleted categories"
ON categories FOR SELECT
TO authenticated
USING (
  deleted_at IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- Update existing update policies to exclude deleted items
DROP POLICY IF EXISTS "Editors and admins can update items" ON items;
CREATE POLICY "Editors and admins can update items"
ON items FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('editor', 'admin')
  )
);

DROP POLICY IF EXISTS "Editors and admins can update locations" ON locations;
CREATE POLICY "Editors and admins can update locations"
ON locations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('editor', 'admin')
  )
);

-- Update path calculation trigger to skip deleted locations
CREATE OR REPLACE FUNCTION calculate_location_path()
RETURNS TRIGGER AS $$
DECLARE
  parent_path TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := NEW.name;
  ELSE
    SELECT path INTO parent_path
    FROM locations
    WHERE id = NEW.parent_id AND deleted_at IS NULL;

    IF parent_path IS NULL THEN
      RAISE EXCEPTION 'Parent location not found or is deleted';
    END IF;

    NEW.path := parent_path || ' / ' || NEW.name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
