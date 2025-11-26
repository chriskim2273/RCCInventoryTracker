import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Extract and verify the JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the user is an admin
    const { data: userData, error: roleError } = await adminClient
      .from('users')
      .select('role, first_name, last_name, email')
      .eq('id', user.id)
      .single()

    if (roleError || userData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the parameters from the request body
    const { userId, email, emailConfirm, password, banDuration } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const updates: any = {}
    const actions: string[] = []

    // Update email if provided
    if (email) {
      updates.email = email
      updates.email_confirm = emailConfirm !== false // default to true
      actions.push('update_email')
    }

    // Update password if provided
    if (password) {
      updates.password = password
      actions.push('reset_password')
    }

    // Ban user if banDuration provided (in hours)
    if (banDuration !== undefined) {
      if (banDuration > 0) {
        const banUntil = new Date()
        banUntil.setHours(banUntil.getHours() + banDuration)
        updates.ban_duration = banDuration
        actions.push(`ban_user_${banDuration}h`)
      } else {
        updates.ban_duration = 'none'
        actions.push('unban_user')
      }
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No updates provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the target user's email for logging
    const { data: targetUserData } = await adminClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    // Update the user
    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      updates
    )

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update user: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log the admin action
    await adminClient.from('audit_logs').insert({
      user_id: user.id,
      user_name: userData.first_name && userData.last_name ? `${userData.first_name} ${userData.last_name}` : userData.email,
      action: actions.join(', '),
      details: {
        target_user_id: userId,
        email: targetUserData?.email,
        updates
      },
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User updated successfully',
        user: updatedUser
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
