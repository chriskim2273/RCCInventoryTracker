-- Add stony_brook_asset_tag field to items table
ALTER TABLE items ADD COLUMN stony_brook_asset_tag TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN items.stony_brook_asset_tag IS 'Stony Brook University asset tag identifier for tracking purposes.';
