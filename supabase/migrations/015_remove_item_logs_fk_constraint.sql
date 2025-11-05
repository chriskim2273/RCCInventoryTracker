-- Remove the foreign key constraint entirely for item_logs
-- This allows audit logs to be preserved after hard deletion
-- The application logic ensures referential integrity

-- Drop the foreign key constraint completely
ALTER TABLE item_logs DROP CONSTRAINT IF EXISTS item_logs_item_id_fkey;

-- Ensure item_id is nullable
ALTER TABLE item_logs ALTER COLUMN item_id DROP NOT NULL;

-- Add a comment explaining why there's no FK constraint
COMMENT ON COLUMN item_logs.item_id IS 'References items(id) but without FK constraint to preserve audit logs after hard deletion. NULL indicates item was permanently deleted.';

-- Create an index for performance (since we removed the FK which had an implicit index)
CREATE INDEX IF NOT EXISTS idx_item_logs_item_id ON item_logs(item_id) WHERE item_id IS NOT NULL;
