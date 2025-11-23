-- Add notification preferences column to users table
-- Admins can opt in to receive email notifications for various events
ALTER TABLE users
ADD COLUMN notification_preferences JSONB DEFAULT '{
  "new_user_signup": false
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN users.notification_preferences IS
'Admin notification preferences. Keys: new_user_signup (boolean) - receive emails when new users sign up';

-- Create index for efficient querying of admins who want new user signup notifications
CREATE INDEX idx_users_notify_new_signup
ON users ((notification_preferences->>'new_user_signup'))
WHERE role = 'admin';
