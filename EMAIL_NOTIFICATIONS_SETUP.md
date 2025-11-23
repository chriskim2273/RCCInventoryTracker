# Email Notifications Setup Guide - Gmail SMTP

This guide explains how to set up email notifications for new user signups using Gmail SMTP in the RCC Inventory Tracker.

## Overview

When a new user signs up, administrators who have opted in to notifications will receive an email alert via Gmail SMTP. This helps ensure that new users are assigned roles promptly.

## Why Gmail SMTP?

As of 2024, Supabase Edge Functions now support port 465, making Gmail SMTP a viable option:
- ✅ **Free** within Gmail's sending limits (100-500 emails/day)
- ✅ **No third-party service** needed
- ✅ **Same credentials** as Supabase Auth emails
- ✅ **Simple setup** - no domain verification required

## Features

- **Opt-in by default**: Notifications are OFF by default to respect admin inboxes
- **Admin control**: Each admin can individually toggle notifications on/off
- **Graceful failures**: If email sending fails, user signup still succeeds
- **Audit logging**: All notification attempts are logged in the audit trail

## Setup Steps

### 1. Apply Database Migration

The database migration adds notification preferences to user accounts.

```bash
# The migration file is located at:
# supabase/migrations/018_add_admin_notification_preferences.sql

# If using Supabase CLI:
supabase db push

# Or run the migration manually in the Supabase SQL editor
```

This adds a `notification_preferences` JSONB column to the `users` table with default value:
```json
{
  "new_user_signup": false
}
```

### 2. Generate Gmail App Password

You **must** use a Gmail App Password (not your regular Gmail password).

**Prerequisites:**
- Gmail account
- 2-Step Verification enabled

**Steps:**

1. **Enable 2-Step Verification**:
   - Go to https://myaccount.google.com/security
   - Click "2-Step Verification"
   - Follow the setup wizard

2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Under **Select app**, choose "Mail"
   - Under **Select device**, choose "Other (Custom name)" → enter "Supabase Edge Functions"
   - Click **Generate**
   - Copy the **16-character password** (displayed without spaces)

**Important**: Save this password - you won't be able to see it again!

### 3. Configure Edge Function Secrets

Set the required environment variables for the edge function:

```bash
# Using Supabase CLI:
supabase secrets set GMAIL_USERNAME=your-email@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=your-16-char-app-password
supabase secrets set SITE_URL=https://your-app-url.com

# Or set them in the Supabase Dashboard:
# Project Settings → Edge Functions → Manage Secrets
```

**Required secrets:**
- `GMAIL_USERNAME`: Your Gmail address (e.g., `notifications@gmail.com`)
- `GMAIL_APP_PASSWORD`: The 16-character App Password from step 2
- `SITE_URL`: Your app's URL (used in email links to admin panel)

**Note**: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available to edge functions.

**Verify secrets are set:**
```bash
supabase secrets list
```

### 4. Deploy the Edge Function

Deploy the `notify-admin-new-user` edge function:

```bash
# Deploy all functions:
supabase functions deploy

# Or deploy just this function:
supabase functions deploy notify-admin-new-user

# Verify deployment:
supabase functions list
```

### 5. Enable Notifications in Admin Panel

1. Log in as an admin user
2. Navigate to the **Admin Panel**
3. Click on the **Settings** tab
4. Toggle **"New User Signups"** to **ON**
5. You'll see a success message confirming your preferences were saved

## How It Works

### Signup Flow

```
User Signs Up
    ↓
User record created with role='pending'
    ↓
Frontend calls notify-admin-new-user edge function
    ↓
Edge function queries for admins with new_user_signup=true
    ↓
Sends email to each opted-in admin via Gmail SMTP (port 465)
    ↓
Logs notification in audit_logs
```

### Email Content

Admins receive a professional HTML email with:
- **Header**: RCC Inventory Tracker branding (red theme)
- **User Details**: Name, email, and status
- **Call-to-Action**: Direct link to the Admin Panel
- **Footer**: Opt-out reminder and preference management instructions

### Technical Implementation

The edge function uses:
- **nodemailer** (version 6.9.10) via npm import
- **Gmail SMTP** on port 465 (SSL/TLS)
- **Supabase service role** for database queries
- **Promise-based** email sending for proper error handling

### Error Handling

- If no admins have opted in → function succeeds with "no admins to notify" message
- If Gmail credentials are missing → function logs error but doesn't fail signup
- If individual emails fail → function continues sending to other admins
- All errors are logged but don't affect the user signup process

## Testing

### Test the Edge Function Directly

You can test the edge function using the Supabase CLI:

```bash
# Test with sample data
supabase functions invoke notify-admin-new-user \
  --body '{"userId":"test-user-id","userEmail":"newuser@stonybrook.edu","firstName":"Test","lastName":"User"}'

# Expected successful response:
# {
#   "success": true,
#   "message": "Notified 1 admin(s)",
#   "details": {
#     "total_admins": 1,
#     "emails_sent": 1,
#     "emails_failed": 0,
#     "provider": "gmail_smtp_port_465"
#   }
# }
```

### Test the Full Flow

1. Make sure you have at least one admin with notifications enabled
2. Sign up with a new @stonybrook.edu email address
3. Check the admin's email inbox for the notification
4. Check the edge function logs:
   ```bash
   supabase functions logs notify-admin-new-user --tail
   ```

### Check Notification Preferences

Query the database to see which admins have notifications enabled:

```sql
SELECT
  email,
  notification_preferences->>'new_user_signup' as notifications_enabled
FROM users
WHERE role = 'admin';
```

## Troubleshooting

### Emails Not Being Sent

**1. Check Edge Function Logs:**
```bash
supabase functions logs notify-admin-new-user --tail
```

Look for error messages related to:
- Authentication failures
- Connection timeouts
- Invalid credentials

**2. Verify Secrets Are Set:**
- Go to Supabase Dashboard → Project Settings → Edge Functions → Manage Secrets
- Ensure `GMAIL_USERNAME`, `GMAIL_APP_PASSWORD`, and `SITE_URL` are present
- Run `supabase secrets list` to confirm

**3. Test Gmail Credentials:**
You can test your Gmail App Password using a simple tool or by checking:
- The password is exactly 16 characters
- No spaces in the password
- 2-Step Verification is still enabled on your Google account

**4. Verify Admin Has Opted In:**
```sql
SELECT email, notification_preferences
FROM users
WHERE role = 'admin';
```

Ensure at least one admin has `"new_user_signup": true`.

### Common Issues

**"Email service not configured"**
- **Cause**: `GMAIL_USERNAME` or `GMAIL_APP_PASSWORD` secret is not set
- **Solution**: Set the secrets as described in Step 3

**"No admins to notify"**
- **Cause**: No admin users have enabled notifications
- **Solution**: Enable notifications in Admin Panel → Settings

**"Failed to query admins"**
- **Cause**: Database connectivity issue or RLS policy blocking access
- **Solution**: Check edge function logs for details. Verify the function has service role access.

**"Invalid login" or "Authentication failed"**
- **Cause**: Incorrect Gmail credentials or App Password
- **Solution**:
  - Verify you're using an App Password, not your regular Gmail password
  - Ensure 2-Step Verification is enabled
  - Generate a new App Password and update the secret

**Emails going to spam**
- **Cause**: Using a free Gmail account without proper sender reputation
- **Solutions**:
  - Use a dedicated Gmail account for notifications
  - Consider using Google Workspace for better deliverability
  - Add SPF records for your domain
  - Ask recipients to mark the first email as "Not Spam"

**Connection timeout errors**
- **Cause**: Port 465 might be blocked (rare as of 2024)
- **Solution**:
  - Check Supabase status page for edge function issues
  - Verify in logs that port 465 is being used (not 587)
  - Ensure `secure: true` in nodemailer config

## Gmail Sending Limits

**Important**: Gmail has daily sending limits:

- **Free Gmail accounts**: ~100-500 emails/day (varies by account age/reputation)
- **Google Workspace accounts**: ~2,000 emails/day

For this use case (new user signup notifications), these limits are more than sufficient. Most organizations see < 10 new signups per day.

### If You Exceed Limits

If you consistently hit Gmail's limits, consider:
- **Resend**: 3,000 emails/month free
- **SendGrid**: 100 emails/day free
- **Mailgun**: 5,000 emails/month free

See `GMAIL_SMTP_EDGE_FUNCTIONS.md` for comparison details.

## Managing Notification Preferences

### For Admins (via UI)

Admins can manage their own preferences:
1. Go to **Admin Panel** → **Settings** tab
2. Toggle **"New User Signups"** on or off
3. Changes take effect immediately for future signups

### For Developers (via SQL)

**Enable notifications for a specific admin:**
```sql
UPDATE users
SET notification_preferences = '{"new_user_signup": true}'::jsonb
WHERE email = 'admin@stonybrook.edu';
```

**Disable notifications:**
```sql
UPDATE users
SET notification_preferences = '{"new_user_signup": false}'::jsonb
WHERE email = 'admin@stonybrook.edu';
```

**View all admin preferences:**
```sql
SELECT
  email,
  role,
  notification_preferences->>'new_user_signup' as new_user_notifications
FROM users
WHERE role = 'admin'
ORDER BY email;
```

**Enable for all admins (bulk operation):**
```sql
UPDATE users
SET notification_preferences = jsonb_set(
  COALESCE(notification_preferences, '{}'::jsonb),
  '{new_user_signup}',
  'true'::jsonb
)
WHERE role = 'admin';
```

## Future Enhancements

The system is designed to be extensible. You can easily add more notification types:

**Example: Role Change Notifications**

1. Add new preference key (no schema change needed):
   ```sql
   UPDATE users
   SET notification_preferences = notification_preferences || '{"role_changes": false}'::jsonb
   WHERE role = 'admin';
   ```

2. Create new edge function or update existing one

3. Add UI toggle in Settings tab

4. Update `AdminPanel.jsx` to call the edge function when roles change

**Other Potential Notification Types:**
- `item_low_stock`: Alert when items are running low
- `checkout_overdue`: Notify about overdue item returns
- `user_deleted`: Alert when a user is removed
- `bulk_import_complete`: Notify when CSV imports finish

## Port 465 Support - Historical Context

**Why This Works Now:**

Prior to late 2024, Supabase Edge Functions (running on Deno Deploy) blocked all SMTP ports including 465. This was documented in several GitHub issues.

In 2024, port 465 support was quietly enabled. [Issue #21977](https://github.com/supabase/supabase/issues/21977) confirmed that port 465 works despite outdated documentation. The docs were corrected via [PR #22071](https://github.com/supabase/supabase/pull/22071).

**Current Status:**
- ✅ Port 465 (SSL/TLS): **Allowed** - Gmail SMTP works!
- ❌ Port 587 (STARTTLS): Still blocked by Deno Deploy
- ❌ Port 25: Blocked by Deno Deploy

This makes Gmail SMTP via port 465 a viable option for Supabase Edge Functions.

## Security Considerations

**App Password Security:**
- App Passwords bypass 2-Step Verification for the specific app
- Store them securely in Supabase secrets (never commit to code)
- Revoke and regenerate if compromised or leaked
- Use dedicated Gmail accounts for applications (not personal accounts)

**Best Practices:**
- Create a dedicated Gmail account like `rcc-notifications@gmail.com` for sending
- Or use Google Workspace with a domain account like `noreply@yourdomain.com`
- Regularly review and revoke unused App Passwords
- Monitor the audit logs for notification activity

**Email Content:**
- Emails don't include sensitive data (no passwords, tokens, or personal info)
- Only basic user details: name, email, signup status
- Links go to authenticated admin panel (requires login)

## Support & Additional Resources

**Documentation:**
- Main setup guide: `supabase/SETUP.md` (Section 8)
- Gmail SMTP research: `GMAIL_SMTP_EDGE_FUNCTIONS.md`
- Project README: `README.md` (Admin Notification System section)

**Troubleshooting:**
1. Check edge function logs: `supabase functions logs notify-admin-new-user`
2. Review audit logs in Admin Panel → Admin Actions
3. Test with the CLI: `supabase functions invoke notify-admin-new-user`

**Getting Help:**
- Check the Supabase Edge Functions documentation
- Review GitHub issues for port restrictions
- Open an issue in the project repository

## Quick Reference

**Setup Checklist:**
- [ ] Apply migration `018_add_admin_notification_preferences.sql`
- [ ] Generate Gmail App Password
- [ ] Set secrets: `GMAIL_USERNAME`, `GMAIL_APP_PASSWORD`, `SITE_URL`
- [ ] Deploy edge function: `supabase functions deploy notify-admin-new-user`
- [ ] Enable notifications in Admin Panel → Settings

**Testing Checklist:**
- [ ] Test edge function with CLI
- [ ] Verify admin has notifications enabled in database
- [ ] Sign up test user and check admin email
- [ ] Check edge function logs for errors
- [ ] Verify audit_logs entry was created

**Maintenance:**
- Monitor Gmail sending limits (check Google account activity)
- Review audit logs periodically for notification failures
- Keep Gmail App Password secure and rotate if needed
- Update edge function if nodemailer version changes
