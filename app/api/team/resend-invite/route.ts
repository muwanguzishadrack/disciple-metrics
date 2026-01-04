import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resendInviteSchema } from '@/lib/validations/team'
import { auditLog, getUserAgent } from '@/lib/audit-log'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  // Rate limit: 10 invites per hour (shared with invite)
  const rateLimitResult = checkRateLimit(ip, 'invite' as never)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many invitation attempts. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isAdmin } = await (supabase as any).rpc('is_admin', {
      p_user_id: user.id,
    })
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Validate input
    const body = await request.json()
    const result = resendInviteSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { invitationId } = result.data

    // Get existing invitation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitation, error: inviteError } = await (supabase as any)
      .from('user_invitations')
      .select('*')
      .eq('id', invitationId)
      .is('accepted_at', null)
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json(
        { error: 'Invitation not found or already accepted' },
        { status: 404 }
      )
    }

    // Type the invitation for later use
    const inv = invitation as { email: string; token: string; expires_at: string }

    // Generate new token and update expiry
    const newToken = crypto.randomBytes(32).toString('hex')
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Update invitation with new token and expiry
    const { error: updateError } = await adminSupabase
      .from('user_invitations')
      .update({
        token: newToken,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invitationId)

    if (updateError) throw updateError

    // Resend invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { error: emailError } = await adminSupabase.auth.admin.inviteUserByEmail(
      inv.email,
      {
        // Use client-side callback to handle hash-based invite tokens
        redirectTo: `${appUrl}/auth/callback`,
        data: {
          invitation_token: newToken,
        },
      }
    )

    if (emailError) {
      // Rollback token update
      await adminSupabase
        .from('user_invitations')
        .update({
          token: inv.token,
          expires_at: inv.expires_at,
        })
        .eq('id', invitationId)
      throw emailError
    }

    await auditLog({
      action: 'TEAM_INVITE_RESENT' as never,
      userId: user.id,
      ip,
      userAgent: getUserAgent(request),
      details: { invitationId, email: inv.email },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Resend invite error:', error)
    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    )
  }
}
