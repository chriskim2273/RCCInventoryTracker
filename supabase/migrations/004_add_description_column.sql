-- Add description column to items table
ALTER TABLE items ADD COLUMN description TEXT;

-- Add comment to document the column
COMMENT ON COLUMN items.description IS 'Optional text description of the item';
