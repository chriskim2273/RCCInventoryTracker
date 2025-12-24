-- Add rejection_reason column to reorder_requests table
ALTER TABLE reorder_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
