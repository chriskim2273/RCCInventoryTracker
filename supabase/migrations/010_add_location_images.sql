-- Add image_url and description columns to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS description TEXT;

-- Add comments
COMMENT ON COLUMN locations.image_url IS 'URL to location image stored in Supabase Storage';
COMMENT ON COLUMN locations.description IS 'Optional text description of the location';
