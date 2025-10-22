-- Enable RLS on checkout_logs table
ALTER TABLE checkout_logs ENABLE ROW LEVEL SECURITY;

-- Allow viewers, editors, and admins to view checkout logs
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

-- Allow editors and admins to create checkout logs
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

-- Allow editors and admins to update checkout logs (for check-ins)
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

-- Prevent deletion of checkout logs
CREATE POLICY "No one can delete checkout logs"
ON checkout_logs FOR DELETE
TO authenticated
USING (false);
