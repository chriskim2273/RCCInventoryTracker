-- Preserve checkout_logs after hard deletion of items
-- This ensures checkout history is maintained even when items are permanently deleted

-- Drop the existing foreign key constraint with CASCADE
ALTER TABLE checkout_logs
DROP CONSTRAINT IF EXISTS checkout_logs_item_id_fkey;

-- Make item_id nullable to allow orphaned logs after item deletion
ALTER TABLE checkout_logs
ALTER COLUMN item_id DROP NOT NULL;

-- Add new foreign key constraint with SET NULL instead of CASCADE
-- This preserves the checkout log entries when items are hard deleted
ALTER TABLE checkout_logs
ADD CONSTRAINT checkout_logs_item_id_fkey
FOREIGN KEY (item_id)
REFERENCES items(id)
ON DELETE SET NULL;

-- Add a comment to document this behavior
COMMENT ON COLUMN checkout_logs.item_id IS 'References items table. NULL value indicates item was hard deleted but checkout history is preserved.';
