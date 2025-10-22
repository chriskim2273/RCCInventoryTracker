-- Drop the checkout_logs table if it exists and recreate it with the correct schema
DROP TABLE IF EXISTS checkout_logs CASCADE;

-- Create checkout logs table with correct schema
CREATE TABLE checkout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  checked_out_to TEXT NOT NULL, -- Name of person (can be anyone, not just users)
  checked_out_to_user_id UUID REFERENCES users(id), -- Optional: link to user if they are a registered user
  checked_out_at TIMESTAMP WITH TIME ZONE NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checkout_notes TEXT,
  checkin_notes TEXT,
  performed_by UUID NOT NULL REFERENCES users(id), -- User who performed the action
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for checkout logs
CREATE INDEX idx_checkout_logs_item_id ON checkout_logs(item_id);
CREATE INDEX idx_checkout_logs_checked_out_to ON checkout_logs(checked_out_to);
CREATE INDEX idx_checkout_logs_checked_out_to_user_id ON checkout_logs(checked_out_to_user_id);
CREATE INDEX idx_checkout_logs_checked_out_at ON checkout_logs(checked_out_at DESC);

-- Enable RLS on checkout_logs table
ALTER TABLE checkout_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Viewers can view checkout logs"
ON checkout_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('viewer', 'editor', 'admin')
  )
);

CREATE POLICY "Editors and admins can create checkout logs"
ON checkout_logs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('editor', 'admin')
  )
);

CREATE POLICY "Editors and admins can update checkout logs"
ON checkout_logs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('editor', 'admin')
  )
);

CREATE POLICY "No one can delete checkout logs"
ON checkout_logs FOR DELETE
TO authenticated
USING (false);

-- Add checkout_log_id to items table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'items' AND column_name = 'checkout_log_id'
  ) THEN
    ALTER TABLE items ADD COLUMN checkout_log_id UUID REFERENCES checkout_logs(id) ON DELETE SET NULL;
  END IF;
END $$;
