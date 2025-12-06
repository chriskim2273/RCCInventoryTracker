-- Add order_link column to items table for storing purchase URLs
ALTER TABLE items ADD COLUMN IF NOT EXISTS order_link TEXT;
