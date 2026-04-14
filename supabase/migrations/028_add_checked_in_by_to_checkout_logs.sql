-- Track which staff member performs check-in (return) on a checkout_logs row.
-- ON DELETE SET NULL preserves history when users are removed; checked_in_by_name
-- mirrors the performed_by_name pattern from migration 020 for the same reason.

ALTER TABLE checkout_logs
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checked_in_by_name TEXT;

CREATE INDEX IF NOT EXISTS idx_checkout_logs_checked_in_by ON checkout_logs(checked_in_by);

COMMENT ON COLUMN checkout_logs.checked_in_by IS 'Staff user who processed the return. NULL for legacy rows or if user was deleted.';
COMMENT ON COLUMN checkout_logs.checked_in_by_name IS 'Display name of staff at time of check-in, preserved if user is later deleted.';
