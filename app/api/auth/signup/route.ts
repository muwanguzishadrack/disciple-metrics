import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    const { email, password, firstName, lastName } = result.data
    const supabase = await createClient()

    const origin = request.headers.get('origin') || ''

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/api/auth/callback`,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
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

    await auditLog({
      action: 'SIGNUP_SUCCESS',
      userId: data.user?.id,
      ip,
      details: { email },
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
