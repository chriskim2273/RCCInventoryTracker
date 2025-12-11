-- Add quantity_updated_at to reorder_requests table
ALTER TABLE reorder_requests ADD COLUMN IF NOT EXISTS quantity_updated_at TIMESTAMP WITH TIME ZONE;

-- Add index for performance in case we need to filter by this
CREATE INDEX IF NOT EXISTS idx_reorder_requests_quantity_updated_at ON reorder_requests(quantity_updated_at);
