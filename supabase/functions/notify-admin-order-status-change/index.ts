// Edge function to notify admins of order request status changes
// Uses Gmail SMTP on port 465 (SSL/TLS) - same pattern as notify-admin-new-user

import nodemailer from 'npm:nodemailer@6.9.10'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Status display configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  new_request: { label: 'New Request', color: '#854d0e', bgColor: '#fef9c3' },
  approved_pending: { label: 'Approved / Pending', color: '#1e40af', bgColor: '#dbeafe' },
  purchased: { label: 'Purchased', color: '#6b21a8', bgColor: '#f3e8ff' },
  arrived: { label: 'Arrived', color: '#c2410c', bgColor: '#ffedd5' },
  documented: { label: 'Documented', color: '#166534', bgColor: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#991b1b', bgColor: '#fee2e2' },
}

// Priority display configuration
const PRIORITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  high: { label: 'High Priority', color: '#991b1b', bgColor: '#fee2e2' },
  standard: { label: 'Standard', color: '#374151', bgColor: '#f3f4f6' },
}

// Create Gmail SMTP transport
const createGmailTransport = () => {
  const gmailUsername = Deno.env.get('GMAIL_USERNAME')
  const gmailAppPassword = Deno.env.get('GMAIL_APP_PASSWORD')

  if (!gmailUsername || !gmailAppPassword) {
    throw new Error('Gmail credentials not configured. Set GMAIL_USERNAME and GMAIL_APP_PASSWORD secrets.')
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: gmailUsername,
      pass: gmailAppPassword,
    },
  })
}

interface RequestBody {
  requestId: string
  oldStatus: string
  newStatus: string
  changedByUserId?: string
  changedByName: string
  itemName: string
  itemBrand?: string
  locationId: string
  categoryId?: string
  priority: string
  quantity: number
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // Parse request body
    const body: RequestBody = await req.json()
    const {
      requestId,
      oldStatus,
      newStatus,
      changedByUserId,
      changedByName,
      itemName,
      itemBrand,
      locationId,
      categoryId,
      priority,
      quantity,
    } = body

    if (!requestId || !newStatus || !itemName) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: requestId, newStatus, itemName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch location name (center)
    let locationName = 'Unknown Location'
    let centerId = locationId
    if (locationId) {
      // Get the location and find its center (top-level parent)
      const { data: location } = await adminClient
        .from('locations')
        .select('id, name, parent_id, path')
        .eq('id', locationId)
        .single()

      if (location) {
        // If it has a parent, use the first part of the path (the center name)
        if (location.path) {
          locationName = location.path.split(' / ')[0]
        } else {
          locationName = location.name
        }

        // Find the center ID (top-level location)
        if (location.parent_id) {
          // Traverse up to find the center
          let currentLocation = location
          while (currentLocation.parent_id) {
            const { data: parentLocation } = await adminClient
              .from('locations')
              .select('id, name, parent_id')
              .eq('id', currentLocation.parent_id)
              .single()

            if (parentLocation) {
              currentLocation = parentLocation
            } else {
              break
            }
          }
          centerId = currentLocation.id
        } else {
          centerId = location.id
        }
      }
    }

    // Fetch category name
    let categoryName = ''
    if (categoryId) {
      const { data: category } = await adminClient
        .from('categories')
        .select('name')
        .eq('id', categoryId)
        .single()

      if (category) {
        categoryName = category.name
      }
    }

    // Query for admins who have opted in to order request status notifications
    // and match the filter criteria
    const { data: admins, error: queryError } = await adminClient
      .from('users')
      .select('id, email, first_name, last_name, notification_preferences')
      .eq('role', 'admin')
      .filter('notification_preferences->order_request_status_change->enabled', 'eq', true)

    if (queryError) {
      console.error('Error querying admins:', queryError)
      return new Response(
        JSON.stringify({ error: 'Failed to query admins', details: queryError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!admins || admins.length === 0) {
      console.log('No admins have opted in to order request status notifications')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No admins to notify (none have opted in)'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter admins based on their preferences
    const filteredAdmins = admins.filter(admin => {
      const prefs = admin.notification_preferences?.order_request_status_change
      if (!prefs || !prefs.enabled) return false

      // Check if the new status is in their subscribed statuses
      const statuses = prefs.statuses || []
      if (statuses.length > 0 && !statuses.includes(newStatus)) {
        return false
      }

      // Check center filter (empty array means all centers)
      const centers = prefs.centers || []
      if (centers.length > 0 && !centers.includes(centerId)) {
        return false
      }

      // Check category filter (empty array means all categories)
      const categories = prefs.categories || []
      if (categories.length > 0 && categoryId && !categories.includes(categoryId)) {
        return false
      }

      return true
    })

    if (filteredAdmins.length === 0) {
      console.log('No admins match the filter criteria for this notification')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No admins match the filter criteria'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Gmail transport
    const transport = createGmailTransport()

    // Get status display info
    const oldStatusConfig = STATUS_CONFIG[oldStatus] || { label: oldStatus, color: '#374151', bgColor: '#f3f4f6' }
    const newStatusConfig = STATUS_CONFIG[newStatus] || { label: newStatus, color: '#374151', bgColor: '#f3f4f6' }
    const priorityConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.standard

    // Build item display name
    const itemDisplayName = itemBrand ? `${itemName} (${itemBrand})` : itemName

    // Send email to each matching admin
    const emailPromises = filteredAdmins.map(async (admin) => {
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
              <h2 style="color: #1f2937; margin-top: 0; margin-bottom: 16px;">Order Request Status Update</h2>

              <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
                Hello ${adminName},
              </p>

              <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
                An order request status has been updated by <strong>${changedByName}</strong>.
              </p>

              <!-- Status Change Badge -->
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; padding: 8px 16px; background-color: ${oldStatusConfig.bgColor}; color: ${oldStatusConfig.color}; border-radius: 6px; font-weight: bold; font-size: 14px;">
                  ${oldStatusConfig.label}
                </span>
                <span style="display: inline-block; padding: 0 12px; color: #6b7280; font-size: 20px;">→</span>
                <span style="display: inline-block; padding: 8px 16px; background-color: ${newStatusConfig.bgColor}; color: ${newStatusConfig.color}; border-radius: 6px; font-weight: bold; font-size: 14px;">
                  ${newStatusConfig.label}
                </span>
              </div>

              <!-- Request Details Box -->
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; color: #1f2937; font-weight: bold;">Request Details:</p>
                <p style="margin: 0 0 4px 0; color: #374151;"><strong>Item:</strong> ${itemDisplayName}</p>
                <p style="margin: 0 0 4px 0; color: #374151;"><strong>Quantity:</strong> ${quantity}</p>
                ${categoryName ? `<p style="margin: 0 0 4px 0; color: #374151;"><strong>Category:</strong> ${categoryName}</p>` : ''}
                <p style="margin: 0 0 4px 0; color: #374151;"><strong>Center:</strong> ${locationName}</p>
                ${priority === 'high' ? `<p style="margin: 0; color: #991b1b;"><strong>Priority:</strong> <span style="background-color: #fee2e2; padding: 2px 8px; border-radius: 4px;">High Priority</span></p>` : ''}
              </div>

              <p style="color: #374151; line-height: 1.6; margin-bottom: 24px;">
                Click the button below to view the full order request details.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${siteUrl}/reorder-requests"
                   style="display: inline-block; background-color: #dc2626; color: #ffffff;
                          padding: 14px 32px; text-decoration: none; border-radius: 6px;
                          font-weight: bold; font-size: 16px;">
                  View Order Requests
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 24px 30px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
                You're receiving this email because you opted in to order request status notifications.
                You can manage your notification preferences in the Admin Panel under "Settings".
              </p>
            </div>
          </div>
        </body>
        </html>
      `

      const emailText = `
Order Request Status Update - RCC Inventory Tracker

Hello ${adminName},

An order request status has been updated by ${changedByName}.

Status Change: ${oldStatusConfig.label} → ${newStatusConfig.label}

Request Details:
- Item: ${itemDisplayName}
- Quantity: ${quantity}
${categoryName ? `- Category: ${categoryName}` : ''}
- Center: ${locationName}
${priority === 'high' ? '- Priority: High Priority' : ''}

View the order request at: ${siteUrl}/reorder-requests

---
You're receiving this email because you opted in to order request status notifications.
You can manage your notification preferences in the Admin Panel.
      `.trim()

      return new Promise((resolve, reject) => {
        transport.sendMail(
          {
            from: `"RCC Inventory Tracker" <${fromEmail}>`,
            to: admin.email,
            subject: `Order Request Update: ${itemDisplayName} → ${newStatusConfig.label}`,
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
      user_id: changedByUserId || null,
      user_name: changedByName || 'System',
      action: 'order_status_notification_sent',
      details: {
        request_id: requestId,
        item_name: itemName,
        old_status: oldStatus,
        new_status: newStatus,
        center: locationName,
        category: categoryName || null,
        notified_admins_count: successCount,
        failed_count: failureCount,
        email_provider: 'gmail_smtp',
      },
    })

    if (failureCount > 0) {
      console.warn(`Some emails failed to send: ${failureCount} failures out of ${filteredAdmins.length} admins`)
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
          total_matching_admins: filteredAdmins.length,
          emails_sent: successCount,
          emails_failed: failureCount,
          provider: 'gmail_smtp_port_465',
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in notify-admin-order-status-change:', error)
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
