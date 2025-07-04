import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for database access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { action, username, password } = await req.json()

    if (action === 'create') {
      // Check if admin user already exists in credentials table
      const { data: existingAdmin, error: checkError } = await supabaseClient
        .from('admin_credentials')
        .select('id')
        .eq('username', 'iamspsadmin')
        .single()

      if (existingAdmin) {
        return new Response(
          JSON.stringify({ success: true, message: 'Admin user already exists' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      }

      // Get admin credentials from database
      const { data: adminCreds, error: credsError } = await supabaseClient
        .from('admin_credentials')
        .select('email, password_hash')
        .eq('username', 'iamspsadmin')
        .single()

      if (credsError || !adminCreds) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin credentials not found in database' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      // Create admin user in auth system using credentials from database
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email: adminCreds.email,
        password: adminCreds.password_hash,
        email_confirm: true
      })

      if (authError) {
        console.error('Auth creation error:', authError)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create auth user' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Admin user created successfully' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    if (action === 'login') {
      // Verify admin credentials against database
      const { data: adminCreds, error: credsError } = await supabaseClient
        .from('admin_credentials')
        .select('username, password_hash, email, is_active')
        .eq('username', username)
        .eq('is_active', true)
        .single()

      if (credsError || !adminCreds) {
        return new Response(
          JSON.stringify({ valid: false, message: 'Invalid credentials' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        )
      }

      // Simple password check (in production, use proper bcrypt comparison)
      const isValid = password === adminCreds.password_hash

      if (isValid) {
        return new Response(
          JSON.stringify({ 
            valid: true, 
            email: adminCreds.email,
            message: 'Credentials valid' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } else {
        return new Response(
          JSON.stringify({ valid: false, message: 'Invalid credentials' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401 
          }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})