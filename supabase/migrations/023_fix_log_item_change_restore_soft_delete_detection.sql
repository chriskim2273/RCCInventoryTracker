-- Fix: Migration 020 accidentally dropped soft_delete/restore detection from 009.
-- This restores it while keeping 020's user_name snapshot feature.

CREATE OR REPLACE FUNCTION log_item_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  current_user_name TEXT;
  log_action log_action;
  change_data JSONB;
  skip_checkout_fields BOOLEAN;
BEGIN
  current_user_id := auth.uid();

  -- Fetch user name (from migration 020)
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
    -- Check soft delete / restore first (from migration 009, lost in 020)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      log_action := 'soft_delete';
      change_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      log_action := 'restore';
      change_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    ELSE
      -- Skip logging if ONLY checkout-related fields changed (from migration 009)
      skip_checkout_fields := (
        OLD.name IS NOT DISTINCT FROM NEW.name AND
        OLD.serial_number IS NOT DISTINCT FROM NEW.serial_number AND
        OLD.quantity IS NOT DISTINCT FROM NEW.quantity AND
        OLD.brand IS NOT DISTINCT FROM NEW.brand AND
        OLD.description IS NOT DISTINCT FROM NEW.description AND
        OLD.category_id IS NOT DISTINCT FROM NEW.category_id AND
        OLD.location_id IS NOT DISTINCT FROM NEW.location_id AND
        OLD.image_url IS NOT DISTINCT FROM NEW.image_url AND
        OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at AND
        OLD.deleted_by IS NOT DISTINCT FROM NEW.deleted_by
      );

      IF skip_checkout_fields THEN
        RETURN NEW;
      END IF;

      log_action := 'update';
      change_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    log_action := 'delete';
    change_data := jsonb_build_object('old', to_jsonb(OLD));

    INSERT INTO item_logs (item_id, user_id, user_name, action, changes)
    VALUES (OLD.id, current_user_id, current_user_name, log_action, change_data);

    RETURN OLD;
  END IF;

  INSERT INTO item_logs (item_id, user_id, user_name, action, changes)
  VALUES (COALESCE(NEW.id, OLD.id), current_user_id, current_user_name, log_action, change_data);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
