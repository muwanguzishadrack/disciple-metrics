import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit-log'
import { loginSchema } from '@/lib/validations/auth'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  // Check rate limit
  const rateLimitResult = checkRateLimit(ip, 'login')
  if (!rateLimitResult.success) {
    await auditLog({
      action: 'LOGIN_RATE_LIMITED',
      ip,
      details: { resetIn: rateLimitResult.resetIn },
    })

    return NextResponse.json(
      {
        error: 'Too many login attempts. Please try again later.',
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
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password } = result.data
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      await auditLog({
        action: 'LOGIN_FAILED',
        ip,
        details: { email, error: error.message },
      })

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    await auditLog({
      action: 'LOGIN_SUCCESS',
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
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
