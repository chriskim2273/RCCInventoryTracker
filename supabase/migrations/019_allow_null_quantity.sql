-- Allow quantity to be nullable to support "Unknown" quantity
ALTER TABLE items ALTER COLUMN quantity DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN items.quantity IS 'Number of items in stock. NULL indicates unknown quantity.';
