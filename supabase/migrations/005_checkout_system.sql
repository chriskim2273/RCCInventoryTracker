-- Create checkout logs table
CREATE TABLE checkout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  checked_out_to TEXT NOT NULL, -- Name of person (can be anyone, not just users)
  checked_out_to_user_id UUID REFERENCES users(id), -- Optional: link to user if they are a registered user
  checked_out_at TIMESTAMP WITH TIME ZONE NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checkout_notes TEXT,
  checkin_notes TEXT,
  performed_by UUID NOT NULL REFERENCES users(id), -- User who performed the action
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for checkout logs
CREATE INDEX idx_checkout_logs_item_id ON checkout_logs(item_id);
CREATE INDEX idx_checkout_logs_checked_out_to ON checkout_logs(checked_out_to);
CREATE INDEX idx_checkout_logs_checked_out_to_user_id ON checkout_logs(checked_out_to_user_id);
CREATE INDEX idx_checkout_logs_checked_out_at ON checkout_logs(checked_out_at DESC);

-- Add checkout_log_id to items table to track current checkout
ALTER TABLE items ADD COLUMN checkout_log_id UUID REFERENCES checkout_logs(id) ON DELETE SET NULL;

-- First, delete any existing check_out/check_in logs
DELETE FROM item_logs WHERE action IN ('check_out', 'check_in');

-- Remove check_out/check_in from log_action enum (we'll handle those separately)
-- Note: PostgreSQL doesn't support removing enum values directly, so we need to recreate the type
ALTER TABLE item_logs ALTER COLUMN action TYPE TEXT;
DROP TYPE log_action;
CREATE TYPE log_action AS ENUM ('create', 'update', 'delete');
ALTER TABLE item_logs ALTER COLUMN action TYPE log_action USING action::log_action;

-- Update the trigger to not log check_out/check_in actions
CREATE OR REPLACE FUNCTION log_item_change()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  log_action log_action;
  change_data JSONB;
BEGIN
  current_user_id := auth.uid();

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

  INSERT INTO item_logs (item_id, user_id, action, changes)
  VALUES (COALESCE(NEW.id, OLD.id), current_user_id, log_action, change_data);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
