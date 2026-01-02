import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit-log'
import { forgotPasswordSchema } from '@/lib/validations/auth'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  // Check rate limit
  const rateLimitResult = checkRateLimit(ip, 'forgotPassword')
  if (!rateLimitResult.success) {
    await auditLog({
      action: 'PASSWORD_RESET_RATE_LIMITED',
      ip,
      details: { resetIn: rateLimitResult.resetIn },
    })

    return NextResponse.json(
      {
        error: 'Too many password reset attempts. Please try again later.',
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
    const result = forgotPasswordSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { email } = result.data
    const supabase = await createClient()
    const origin = request.headers.get('origin') || ''

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/api/auth/callback?next=/reset-password`,
    })

    // Always return success to prevent email enumeration
    // Log the actual result for audit purposes
    await auditLog({
      action: 'PASSWORD_RESET_REQUEST',
      ip,
      details: { email, success: !error },
    })

    if (error) {
      console.error('Password reset error:', error)
    }

    // Always return success message to prevent email enumeration
    return NextResponse.json(
      {
        success: true,
        message: 'If an account exists with this email, you will receive password reset instructions.',
      },
      {
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
        },
      }
    )
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
