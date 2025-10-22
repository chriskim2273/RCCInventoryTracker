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

    // Create admin client with service role key to verify the JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Extract the JWT token from the Authorization header
    const token = authHeader.replace('Bearer ', '')

    // Verify the JWT token using the admin client
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: authError?.message || 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if the user is an admin
    const { data: userData, error: roleError } = await adminClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || userData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all users from the database
    const { data: dbUsers, error: dbError } = await adminClient
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch users: ${dbError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get auth details for each user
    const usersWithAuthDetails = await Promise.all(
      dbUsers.map(async (dbUser) => {
        const { data: authData, error: authError } = await adminClient.auth.admin.getUserById(
          dbUser.id
        )

        return {
          id: dbUser.id,
          email: dbUser.email,
          first_name: dbUser.first_name,
          last_name: dbUser.last_name,
          role: dbUser.role,
          created_at: dbUser.created_at,
          // Auth-specific details
          email_confirmed_at: authData?.user?.email_confirmed_at || null,
          last_sign_in_at: authData?.user?.last_sign_in_at || null,
          confirmed: !!authData?.user?.email_confirmed_at,
          banned: authData?.user?.banned_until ? new Date(authData.user.banned_until) > new Date() : false,
          phone: authData?.user?.phone || null,
          auth_error: authError ? authError.message : null,
        }
      })
    )

    return new Response(
      JSON.stringify({ users: usersWithAuthDetails }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
