-- Add user name columns to log tables to preserve history when users are deleted

-- 1. item_logs
ALTER TABLE item_logs ADD COLUMN IF NOT EXISTS user_name TEXT;

-- 2. audit_logs
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;

-- 3. checkout_logs
ALTER TABLE checkout_logs ADD COLUMN IF NOT EXISTS performed_by_name TEXT;
-- checked_out_to is already TEXT and stores the name

-- 4. items
ALTER TABLE items ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;

-- 5. locations
ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;

-- 6. categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;

-- Update log_item_change trigger to include user_name
CREATE OR REPLACE FUNCTION log_item_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  current_user_name TEXT;
  log_action log_action;
  change_data JSONB;
BEGIN
  current_user_id := auth.uid();
  
  -- Fetch user name
  IF current_user_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN first_name || ' ' || last_name
        ELSE email 
      END INTO current_user_name
    FROM public.users
    WHERE id = current_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    log_action := 'create';
    change_data := jsonb_build_object('new', to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    -- Skip logging if only checkout-related fields changed
    IF OLD.checked_out_by IS DISTINCT FROM NEW.checked_out_by
       OR OLD.checkout_log_id IS DISTINCT FROM NEW.checkout_log_id THEN
      RETURN NEW;
    END IF;
    log_action := 'update';
    change_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    log_action := 'delete';
    change_data := jsonb_build_object('old', to_jsonb(OLD));
  END IF;

  INSERT INTO item_logs (item_id, user_id, user_name, action, changes)
  VALUES (COALESCE(NEW.id, OLD.id), current_user_id, current_user_name, log_action, change_data);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
