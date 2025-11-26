# Fix Unclear Admin Logs

## Goal Description
Improve the clarity of "Admin Actions" logs, specifically for "User Deletion" and "NEW USER_NOTIFICATION_SENT" events. Ensure that "User Deletion" clearly shows who was deleted, and "NEW USER_NOTIFICATION_SENT" is attributed to "System" rather than "Unknown User" and displays relevant details.

## Proposed Changes

### Backend (Edge Functions)

#### [MODIFY] [delete-user/index.ts](file:///Users/poyto/RCCInventoryTracker/supabase/functions/delete-user/index.ts)
- Fetch the target user's details (email, first name, last name) *before* deleting them.
- Include these details in the `audit_logs` `details` JSONB column.

#### [MODIFY] [notify-admin-new-user/index.ts](file:///Users/poyto/RCCInventoryTracker/supabase/functions/notify-admin-new-user/index.ts)
- Add `user_name: 'System'` to the `audit_logs` insert to prevent "Unknown User" display.
- Ensure `details` contains consistent fields for the frontend to consume.

### Frontend

#### [MODIFY] [AdminPanel.jsx](file:///Users/poyto/RCCInventoryTracker/src/pages/AdminPanel.jsx)
- Update `audit_logs` rendering logic:
    - For `delete_user`: Display the deleted user's name and email from `log.details`.
    - For `new_user_notification_sent`:
        - Display "System" as the actor if `user_name` is "System" or if it's this specific action.
        - Display "New User: [Name] ([Email])" and notification stats.
    - General improvement: Check for `log.details.email` OR `log.details.user_email` OR `log.details.new_user_email` to be more robust.

## Verification Plan

### Manual Verification
1.  **User Deletion**:
    - Create a test user.
    - Delete the test user via the Admin Panel.
    - Verify the "Admin Actions" log shows "User Deletion" with "Target: [Name] ([Email])".
2.  **New User Notification**:
    - Trigger the `notify-admin-new-user` function (e.g., by signing up a new user if possible, or mocking the call).
    - Verify the "Admin Actions" log shows "NEW USER NOTIFICATION SENT" with "Admin: System" (or "System") and "New User: [Name] ([Email])".
