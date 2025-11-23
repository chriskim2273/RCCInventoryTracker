# Gmail SMTP for Supabase Edge Functions - Research & Implementation

## Executive Summary

**✅ Gmail SMTP IS FEASIBLE** from Supabase Edge Functions using **port 465 (SSL/TLS)**.

As of late 2024, Supabase Edge Functions (running on Deno Deploy) **now allow** outgoing connections to port 465, making Gmail SMTP a viable option.

## Port Restrictions - Current State

### What Works
- ✅ **Port 465 (SSL/TLS)**: **ALLOWED** - Gmail SMTP works!
- ✅ **Port 2525**: Allowed (but Gmail doesn't support this)
- ✅ **Port 2587**: Allowed (AWS SES uses this)

### What Doesn't Work
- ❌ **Port 25**: Blocked by Deno Deploy
- ❌ **Port 587 (STARTTLS)**: Blocked by Deno Deploy

## Gmail SMTP Configuration

Gmail officially supports:
- **Port 465**: SSL/TLS (implicit TLS) - **Use this one!**
- **Port 587**: STARTTLS (explicit TLS) - Blocked, can't use

## Implementation Code

Here's how to modify the `notify-admin-new-user` edge function to use Gmail SMTP:

### 1. Install nodemailer from npm

```typescript
import nodemailer from 'npm:nodemailer@6.9.10'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
```

### 2. Create SMTP Transport

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configure Gmail SMTP transport
const createGmailTransport = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, // Use port 465 (SSL/TLS) - this works with Edge Functions!
    secure: true, // true for 465, false for other ports
    auth: {
      user: Deno.env.get('GMAIL_USERNAME'), // your Gmail address
      pass: Deno.env.get('GMAIL_APP_PASSWORD'), // Gmail App Password (not your regular password!)
    },
  })
}
```

### 3. Send Email Function

```typescript
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const siteUrl = Deno.env.get('SITE_URL') || supabaseUrl
    const fromEmail = Deno.env.get('GMAIL_USERNAME')!

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get new user details from request
    const { userId, userEmail, firstName, lastName } = await req.json()

    if (!userId || !userEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Query for admins who have opted in
    const { data: admins, error: queryError } = await adminClient
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('role', 'admin')
      .filter('notification_preferences->new_user_signup', 'eq', true)

    if (queryError) {
      console.error('Error querying admins:', queryError)
      return new Response(
        JSON.stringify({ error: 'Failed to query admins' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!admins || admins.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No admins to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Gmail transport
    const transport = createGmailTransport()

    // Prepare user display name
    const displayName = firstName && lastName ? `${firstName} ${lastName}` : userEmail

    // Send email to each opted-in admin
    const emailPromises = admins.map(async (admin) => {
      const adminName = admin.first_name || 'Admin'

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background-color: #2563eb; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">RCC Inventory Tracker</h1>
            </div>

            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin-top: 0;">New User Signup</h2>
              <p style="color: #374151; line-height: 1.6;">Hello ${adminName},</p>
              <p style="color: #374151; line-height: 1.6;">
                A new user has signed up and is waiting for role assignment.
              </p>

              <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 20px; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-weight: bold;">User Details:</p>
                <p style="margin: 0 0 4px 0;"><strong>Name:</strong> ${displayName}</p>
                <p style="margin: 0 0 4px 0;"><strong>Email:</strong> ${userEmail}</p>
                <p style="margin: 0;"><strong>Status:</strong> <span style="color: #dc2626;">Pending Role Assignment</span></p>
              </div>

              <div style="text-align: center; margin: 24px 0;">
                <a href="${siteUrl}/admin"
                   style="display: inline-block; background-color: #2563eb; color: #ffffff;
                          padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Open Admin Panel
                </a>
              </div>
            </div>

            <div style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #6b7280;">
                You're receiving this because you opted in to new user signup notifications.
                Manage preferences in Admin Panel → Settings.
              </p>
            </div>
          </div>
        </body>
        </html>
      `

      const emailText = `
New User Signup - RCC Inventory Tracker

Hello ${adminName},

A new user has signed up and is waiting for role assignment.

User Details:
- Name: ${displayName}
- Email: ${userEmail}
- Status: Pending Role Assignment

Visit the admin panel: ${siteUrl}/admin
      `.trim()

      // Send email using nodemailer
      return new Promise((resolve, reject) => {
        transport.sendMail(
          {
            from: `"RCC Inventory" <${fromEmail}>`,
            to: admin.email,
            subject: `New User Signup: ${displayName}`,
            text: emailText,
            html: emailHtml,
          },
          (error, info) => {
            if (error) {
              console.error(`Failed to send to ${admin.email}:`, error)
              reject(error)
            } else {
              console.log(`Email sent to ${admin.email}:`, info.messageId)
              resolve(info)
            }
          }
        )
      })
    })

    // Wait for all emails
    const results = await Promise.allSettled(emailPromises)

    const successCount = results.filter((r) => r.status === 'fulfilled').length
    const failureCount = results.filter((r) => r.status === 'rejected').length

    // Log in audit_logs
    await adminClient.from('audit_logs').insert({
      action: 'new_user_notification_sent',
      details: {
        new_user_email: userEmail,
        new_user_name: displayName,
        notified_admins_count: successCount,
        failed_count: failureCount,
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notified ${successCount} admin(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        details: { total_admins: admins.length, emails_sent: successCount, emails_failed: failureCount },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

## Setup Steps

### 1. Generate Gmail App Password

You MUST use an App Password (not your regular Gmail password):

1. Enable 2-Step Verification on your Google account:
   - Go to https://myaccount.google.com/security
   - Enable "2-Step Verification"

2. Generate an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Select app: "Mail"
   - Select device: "Other (Custom name)" → enter "Supabase Edge Functions"
   - Click "Generate"
   - Copy the 16-character password (no spaces)

### 2. Set Edge Function Secrets

```bash
# Set Gmail credentials
supabase secrets set GMAIL_USERNAME=your-email@gmail.com
supabase secrets set GMAIL_APP_PASSWORD=your-16-char-app-password

# Set site URL
supabase secrets set SITE_URL=https://your-app-url.com

# Verify secrets are set
supabase secrets list
```

### 3. Deploy the Function

```bash
supabase functions deploy notify-admin-new-user
```

### 4. Test It

```bash
# Test the function
supabase functions invoke notify-admin-new-user \
  --body '{"userId":"test-id","userEmail":"test@stonybrook.edu","firstName":"Test","lastName":"User"}'

# Check logs
supabase functions logs notify-admin-new-user --tail
```

## Gmail Sending Limits

**Important**: Gmail has daily sending limits:

- **Free Gmail accounts**: ~100-500 emails/day
- **Google Workspace accounts**: ~2,000 emails/day

For higher volume, consider:
- Resend (3,000 emails/month free)
- SendGrid (100 emails/day free)
- Mailgun (5,000 emails/month free)

## Comparison: Gmail SMTP vs. Resend API

### Gmail SMTP (Port 465)
**Pros:**
- ✅ Free (within Gmail limits)
- ✅ No third-party service needed
- ✅ Uses existing Gmail infrastructure
- ✅ Familiar setup for those with Gmail experience

**Cons:**
- ❌ Lower sending limits (100-500/day)
- ❌ Requires App Password management
- ❌ SMTP can be slower than APIs
- ❌ Less detailed delivery analytics
- ❌ May trigger spam filters more easily

### Resend API
**Pros:**
- ✅ Higher free tier (3,000/month)
- ✅ Better deliverability
- ✅ Detailed analytics and webhooks
- ✅ Faster API calls vs. SMTP
- ✅ Built for transactional emails

**Cons:**
- ❌ Requires third-party account
- ❌ Domain verification recommended
- ❌ One more service to manage

## Recommendation

**For this use case (new user signup notifications):**

Given that:
- You'll likely have < 50 new signups per day
- Gmail SMTP now works with port 465
- You already have Gmail SMTP configured for Supabase Auth

**I recommend starting with Gmail SMTP** because:
1. You're already using it for Supabase Auth emails
2. Same credentials, no new service needed
3. Volume is low enough for Gmail limits
4. Simpler setup (no domain verification needed)

**Migrate to Resend/SendGrid later if:**
- You exceed Gmail's sending limits
- You need better deliverability tracking
- You want webhook support for bounces/complaints

## Troubleshooting

### "Invalid login" or "Authentication failed"
- Make sure you're using an **App Password**, not your regular Gmail password
- Verify 2-Step Verification is enabled on your Google account
- Double-check the `GMAIL_APP_PASSWORD` secret is set correctly

### Emails not sending
```bash
# Check function logs
supabase functions logs notify-admin-new-user --tail

# Test Gmail SMTP manually with curl (won't work directly, but helps debug)
# You'll see any connection errors in the logs
```

### "Connection timeout" or "Port blocked"
- Verify you're using **port 465** (not 587)
- Check that `secure: true` is set in nodemailer config

### Emails going to spam
- Add SPF records for your domain
- Consider using Google Workspace instead of free Gmail
- Or migrate to a transactional email service (Resend, SendGrid)

## Security Considerations

**App Password Security:**
- App Passwords bypass 2-Step Verification
- Store them securely in Supabase secrets (never in code)
- Revoke and regenerate if compromised
- Use dedicated Gmail accounts for applications (not personal accounts)

**Best Practice:**
Create a dedicated Gmail account like `noreply@yourdomain.com` (via Google Workspace) or `rcc-notifications@gmail.com` specifically for sending notifications.

## Historical Context

**Why This Works Now:**

Prior to late 2024, Supabase Edge Functions (Deno Deploy) blocked all SMTP ports including 465. This was documented in [Issue #6255](https://github.com/supabase/supabase/issues/6255).

In 2024, [Issue #21977](https://github.com/supabase/supabase/issues/21977) reported that port 465 was actually working despite the documentation. The issue was marked as "COMPLETED" and the documentation was corrected via [PR #22071](https://github.com/supabase/supabase/pull/22071).

**TL;DR**: Port 465 was quietly enabled, making Gmail SMTP viable for Edge Functions.

## Alternative: Keep Resend, Add Gmail as Fallback

You could also implement a **dual-provider approach**:

```typescript
const sendEmail = async (to, subject, html, text) => {
  try {
    // Try Resend API first (faster, better deliverability)
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    })

    if (resendResponse.ok) return { provider: 'resend', success: true }
    throw new Error('Resend failed')
  } catch (error) {
    console.warn('Resend failed, falling back to Gmail SMTP:', error)

    // Fallback to Gmail SMTP
    const transport = createGmailTransport()
    return new Promise((resolve, reject) => {
      transport.sendMail({ from, to, subject, html, text }, (err, info) => {
        if (err) reject(err)
        else resolve({ provider: 'gmail', success: true, messageId: info.messageId })
      })
    })
  }
}
```

This gives you the best of both worlds: Resend's performance with Gmail as backup.

## Conclusion

**Gmail SMTP via port 465 is now a viable option** for Supabase Edge Functions. For your use case (new user signup notifications), it's a perfectly reasonable choice given the low volume and the fact that you're already using Gmail SMTP for Supabase Auth.

Start with Gmail SMTP, monitor your sending volume, and migrate to Resend/SendGrid only if needed.
