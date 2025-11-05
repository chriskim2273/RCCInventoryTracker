-- Preserve audit logs and other logs when users are deleted
-- This migration removes foreign key constraints that prevent user deletion
-- and allows logs to be preserved for historical/audit purposes

-- 1. Fix item_logs.user_id constraint
-- Drop the existing constraint and make user_id nullable to preserve logs
ALTER TABLE item_logs DROP CONSTRAINT IF EXISTS item_logs_user_id_fkey;
ALTER TABLE item_logs ALTER COLUMN user_id DROP NOT NULL;

-- Add a comment explaining the design
COMMENT ON COLUMN item_logs.user_id IS 'References users(id) but without FK constraint to preserve audit logs after user deletion. NULL indicates user was deleted.';

-- Create an index for performance (since we removed the FK which had an implicit index)
CREATE INDEX IF NOT EXISTS idx_item_logs_user_id ON item_logs(user_id) WHERE user_id IS NOT NULL;

-- 2. Fix audit_logs.user_id constraint
-- Drop the existing constraint and make user_id nullable to preserve audit trail
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;

-- Add a comment explaining the design
COMMENT ON COLUMN audit_logs.user_id IS 'References users(id) but without FK constraint to preserve audit logs after user deletion. NULL indicates user was deleted.';

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_nullable ON audit_logs(user_id) WHERE user_id IS NOT NULL;

-- 3. Fix checkout_logs.performed_by constraint
-- This is the user who performed the checkout/checkin action
ALTER TABLE checkout_logs DROP CONSTRAINT IF EXISTS checkout_logs_performed_by_fkey;
ALTER TABLE checkout_logs ALTER COLUMN performed_by DROP NOT NULL;

-- Add a comment explaining the design
COMMENT ON COLUMN checkout_logs.performed_by IS 'References users(id) but without FK constraint to preserve checkout logs after user deletion. NULL indicates user was deleted.';

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_checkout_logs_performed_by ON checkout_logs(performed_by) WHERE performed_by IS NOT NULL;

-- 4. Fix checkout_logs.checked_out_to_user_id constraint
-- This is already nullable, just drop the FK constraint
ALTER TABLE checkout_logs DROP CONSTRAINT IF EXISTS checkout_logs_checked_out_to_user_id_fkey;

-- Add a comment explaining the design
COMMENT ON COLUMN checkout_logs.checked_out_to_user_id IS 'Optional reference to users(id) for registered users. No FK constraint to preserve checkout logs after user deletion.';

-- 5. Fix items.checked_out_by - already has ON DELETE SET NULL, so it's OK

-- 6. Fix items.created_by constraint
-- This should be preserved in the audit trail, so remove the constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_created_by_fkey;
ALTER TABLE items ALTER COLUMN created_by DROP NOT NULL;

-- Add a comment explaining the design
COMMENT ON COLUMN items.created_by IS 'References users(id) but without FK constraint to preserve item history after user deletion. NULL indicates user was deleted.';

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_items_created_by ON items(created_by) WHERE created_by IS NOT NULL;

-- 7. Fix items.deleted_by constraint
-- Preserve soft delete history when user is deleted
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_deleted_by_fkey;

-- Add a comment explaining the design
COMMENT ON COLUMN items.deleted_by IS 'References users(id) but without FK constraint to preserve soft delete history after user deletion. NULL indicates either not deleted or deleting user was removed.';

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_items_deleted_by ON items(deleted_by) WHERE deleted_by IS NOT NULL;

-- 8. Fix locations.deleted_by constraint
-- Preserve soft delete history when user is deleted
ALTER TABLE locations DROP CONSTRAINT IF EXISTS locations_deleted_by_fkey;

-- Add a comment explaining the design
COMMENT ON COLUMN locations.deleted_by IS 'References users(id) but without FK constraint to preserve soft delete history after user deletion. NULL indicates either not deleted or deleting user was removed.';

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_locations_deleted_by ON locations(deleted_by) WHERE deleted_by IS NOT NULL;

-- 9. Fix categories.deleted_by constraint
-- Preserve soft delete history when user is deleted
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_deleted_by_fkey;

-- Add a comment explaining the design
COMMENT ON COLUMN categories.deleted_by IS 'References users(id) but without FK constraint to preserve soft delete history after user deletion. NULL indicates either not deleted or deleting user was removed.';

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_categories_deleted_by ON categories(deleted_by) WHERE deleted_by IS NOT NULL;
