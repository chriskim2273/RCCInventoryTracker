-- Add order request status change notification preferences to users table
-- Extends the existing notification_preferences JSONB column

-- Update the default notification_preferences to include order request settings
-- New users will get this structure by default
ALTER TABLE users
ALTER COLUMN notification_preferences
SET DEFAULT '{
  "new_user_signup": false,
  "order_request_status_change": {
    "enabled": false,
    "statuses": ["approved_pending", "purchased", "arrived", "documented", "rejected"],
    "centers": [],
    "categories": []
  }
}'::jsonb;

-- Backfill existing users who have notification_preferences but not the new structure
UPDATE users
SET notification_preferences = notification_preferences || '{
  "order_request_status_change": {
    "enabled": false,
    "statuses": ["approved_pending", "purchased", "arrived", "documented", "rejected"],
    "centers": [],
    "categories": []
  }
}'::jsonb
WHERE notification_preferences IS NOT NULL
  AND NOT (notification_preferences ? 'order_request_status_change');

-- Handle users with NULL notification_preferences
UPDATE users
SET notification_preferences = '{
  "new_user_signup": false,
  "order_request_status_change": {
    "enabled": false,
    "statuses": ["approved_pending", "purchased", "arrived", "documented", "rejected"],
    "centers": [],
    "categories": []
  }
}'::jsonb
WHERE notification_preferences IS NULL;

-- Make notification_preferences NOT NULL now that all users have a value
ALTER TABLE users
ALTER COLUMN notification_preferences SET NOT NULL;

-- Create index for efficient admin queries on order request notifications
CREATE INDEX idx_users_order_status_notify
ON users ((notification_preferences->'order_request_status_change'->>'enabled'))
WHERE role = 'admin';

-- Update column comment to document the new structure
COMMENT ON COLUMN users.notification_preferences IS
'Admin notification preferences (JSONB). Structure:
  - new_user_signup (boolean): receive emails when new users sign up
  - order_request_status_change (object): order request notification settings
    - enabled (boolean): master toggle for order request notifications
    - statuses (array of strings): which status changes trigger notifications
      Valid values: new_request, approved_pending, purchased, arrived, documented, rejected
    - centers (array of UUIDs): filter by center location IDs (empty array = all centers)
    - categories (array of UUIDs): filter by category IDs (empty array = all categories)';
