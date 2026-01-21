import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit-log'
import { signupSchema } from '@/lib/validations/auth'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  // Check rate limit
  const rateLimitResult = checkRateLimit(ip, 'signup')
  if (!rateLimitResult.success) {
    await auditLog({
      action: 'SIGNUP_RATE_LIMITED',
      ip,
      details: { resetIn: rateLimitResult.resetIn },
    })

    return NextResponse.json(
      {
        error: 'Too many signup attempts. Please try again later.',
        resetIn: rateLimitResult.resetIn,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.resetIn),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetIn),
        },
      }
    )
  }

  try {
    const body = await request.json()

    // Validate input
    const result = signupSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password, locationId } = result.data
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    const origin = request.headers.get('origin') || ''

    // Get Pastor role ID
    const { data: pastorRole, error: roleError } = await adminSupabase
      .from('roles')
      .select('id')
      .eq('name', 'pastor')
      .single()

    if (roleError || !pastorRole) {
      console.error('Failed to get pastor role:', roleError)
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
      )
    }

    // Check if location is already assigned to someone
    const { data: existingAssignment } = await adminSupabase
      .from('user_assignments')
      .select('id')
      .eq('location_id', locationId)
      .maybeSingle()

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'This location already has a registered pastor. Please select a different location or contact an administrator.' },
        { status: 409 }
      )
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/api/auth/callback`,
      },
    })

    if (error) {
      await auditLog({
        action: 'SIGNUP_FAILED',
        ip,
        details: { email, error: error.message },
      })

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Create user assignment with Pastor role
    if (data.user) {
      const { error: assignmentError } = await adminSupabase
        .from('user_assignments')
        .insert({
          user_id: data.user.id,
          role_id: pastorRole.id,
          fob_id: null, // Pastor assignment only needs location_id
          location_id: locationId,
        })

      if (assignmentError) {
        console.error('Failed to create user assignment:', assignmentError)
        // Don't fail the signup, but log the error
        await auditLog({
          action: 'SIGNUP_ASSIGNMENT_FAILED',
          userId: data.user.id,
          ip,
          details: { email, error: assignmentError.message },
        })
      }
    }

    await auditLog({
      action: 'SIGNUP_SUCCESS',
      userId: data.user?.id,
      ip,
      details: { email, locationId },
    })

    return NextResponse.json(
      { success: true, user: data.user },
      {
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
