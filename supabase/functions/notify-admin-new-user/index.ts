// Gmail SMTP version of the notify-admin-new-user edge function
// This uses nodemailer with Gmail SMTP on port 465 (SSL/TLS)
// To use this version, rename it to index.ts

import nodemailer from 'npm:nodemailer@6.9.10'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Create Gmail SMTP transport
// Port 465 with SSL/TLS is now supported by Supabase Edge Functions!
const createGmailTransport = () => {
  const gmailUsername = Deno.env.get('GMAIL_USERNAME')
  const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD')

  if (!gmailUsername || !gmailAppPassword) {
    throw new Error('Gmail credentials not configured. Set GMAIL_USERNAME and GMAIL_APP_PASSWORD secrets.')
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, // SSL/TLS port - this works with Edge Functions!
    secure: true, // true for port 465
    auth: {
      user: gmailUsername,
      pass: gmailAppPassword, // Must be a Gmail App Password, not regular password
    },
  })
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client with service role key
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
        JSON.stringify({ error: 'Missing required parameters: userId and userEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Query for admins who have opted in to new user signup notifications
    const { data: admins, error: queryError } = await adminClient
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('role', 'admin')
      .filter('notification_preferences->new_user_signup', 'eq', true)

    if (queryError) {
      console.error('Error querying admins:', queryError)
      return new Response(
        JSON.stringify({ error: 'Failed to query admins', details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!admins || admins.length === 0) {
      console.log('No admins have opted in to new user signup notifications')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No admins to notify (none have opted in)'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Gmail transport
    const transport = createGmailTransport()

    // Prepare user display name
    const displayName = firstName && lastName
      ? `${firstName} ${lastName}`
      : userEmail

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
            <!-- Header -->
            <div style="background-color: #dc2626; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">RCC Inventory Tracker</h1>
            </div>

            <!-- Content -->
            <div style="padding: 40px 30px;">
              <h2 style="color: #1f2937; margin-top: 0; margin-bottom: 16px;">New User Signup</h2>

              <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
                Hello ${adminName},
              </p>

              <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
                A new user has signed up for RCC Inventory Tracker and is waiting for role assignment.
              </p>

              <!-- User Details Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #1f2937; font-weight: bold;">User Details:</p>
                <p style="margin: 0 0 4px 0; color: #374151;"><strong>Name:</strong> ${displayName}</p>
                <p style="margin: 0 0 4px 0; color: #374151;"><strong>Email:</strong> ${userEmail}</p>
                <p style="margin: 0; color: #374151;"><strong>Status:</strong> <span style="color: #dc2626;">Pending Role Assignment</span></p>
              </div>

              <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
                Please log in to the admin panel to assign a role to this user so they can access the system.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${siteUrl}/admin"
                   style="display: inline-block; background-color: #dc2626; color: #ffffff;
                          padding: 14px 32px; text-decoration: none; border-radius: 6px;
                          font-weight: bold; font-size: 16px;">
                  Open Admin Panel
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                You're receiving this email because you opted in to new user signup notifications.
                You can manage your notification preferences in the Admin Panel under "Settings".
              </p>
            </div>
          </div>
        </body>
        </html>
      `

      const emailText = `
New User Signup - RCC Inventory Tracker

Hello ${adminName},

A new user has signed up for RCC Inventory Tracker and is waiting for role assignment.

User Details:
- Name: ${displayName}
- Email: ${userEmail}
- Status: Pending Role Assignment

Please log in to the admin panel to assign a role to this user:
${siteUrl}/admin

---
You're receiving this email because you opted in to new user signup notifications.
You can manage your notification preferences in the Admin Panel.
      `.trim()

      // Send email using nodemailer with Gmail SMTP
      return new Promise((resolve, reject) => {
        transport.sendMail(
          {
            from: `"RCC Inventory Tracker" <${fromEmail}>`,
            to: admin.email,
            subject: `New User Signup: ${displayName}`,
            text: emailText,
            html: emailHtml,
          },
          (error, info) => {
            if (error) {
              console.error(`Failed to send email to ${admin.email}:`, error)
              reject(error)
            } else {
              console.log(`Email sent successfully to ${admin.email}. Message ID: ${info.messageId}`)
              resolve(info)
            }
          }
        )
      })
    })

    // Wait for all emails to be sent
    const results = await Promise.allSettled(emailPromises)

    // Count successes and failures
    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failureCount = results.filter(r => r.status === 'rejected').length

    // Log the notification in audit_logs
    await adminClient.from('audit_logs').insert({
      user_name: 'System',
      action: 'new_user_notification_sent',
      details: {
        new_user_email: userEmail,
        new_user_name: displayName,
        notified_admins_count: successCount,
        failed_count: failureCount,
        email_provider: 'gmail_smtp',
      },
    })

    if (failureCount > 0) {
      console.warn(`Some emails failed to send: ${failureCount} failures out of ${admins.length} admins`)
      // Get error details
      const errors = results
        .filter(r => r.status === 'rejected')
        .map(r => (r as PromiseRejectedResult).reason?.message || 'Unknown error')
      console.error('Email errors:', errors)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notified ${successCount} admin(s)${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
        details: {
          total_admins: admins.length,
          emails_sent: successCount,
          emails_failed: failureCount,
          provider: 'gmail_smtp_port_465',
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notify-admin-new-user (Gmail SMTP):', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        provider: 'gmail_smtp'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
