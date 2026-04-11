import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ isAdmin: false, reason: 'no_auth' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Verify the user's JWT
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ isAdmin: false, reason: 'invalid_token' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Use service role to check admin roles (bypasses RLS)
    const admin = createClient(supabaseUrl, supabaseServiceKey)

    // Check by auth_profile_id linked to user email
    const { data: profile } = await admin
      .from('crm_auth_profiles')
      .select('id')
      .eq('email', user.email)
      .eq('is_active', true)
      .maybeSingle()

    let isAdminUser = false
    let roleType: string | null = null
    let checkMethod = 'email'

    if (profile) {
      const { data: role } = await admin
        .from('crm_admin_roles')
        .select('id, role_type')
        .eq('auth_profile_id', profile.id)
        .eq('is_active', true)
        .maybeSingle()

      if (role) {
        isAdminUser = true
        roleType = role.role_type
      }
    }

    // Fallback: check by kybe_did = user.id (UUID) for newer entries
    if (!isAdminUser) {
      const { data: role } = await admin
        .from('crm_admin_roles')
        .select('id, role_type')
        .eq('kybe_did', user.id)
        .eq('is_active', true)
        .maybeSingle()

      if (role) {
        isAdminUser = true
        roleType = role.role_type
        checkMethod = 'uuid'
      }
    }

    return new Response(
      JSON.stringify({
        isAdmin: isAdminUser,
        roleType,
        method: isAdminUser ? checkMethod : null,
        did: user.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('[check-admin-aa]', err)
    return new Response(JSON.stringify({ isAdmin: false, reason: 'error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})
