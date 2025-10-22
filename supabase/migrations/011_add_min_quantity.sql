-- Add min_quantity field to items table
ALTER TABLE items ADD COLUMN min_quantity INTEGER;

-- Add comment to explain the field
COMMENT ON COLUMN items.min_quantity IS 'Minimum quantity threshold for low stock warnings. NULL means no warning.';
