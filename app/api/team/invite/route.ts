import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inviteMemberSchema } from '@/lib/validations/team'
import { auditLog, getUserAgent } from '@/lib/audit-log'
import { getClientIp, checkRateLimit } from '@/lib/rate-limit'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)

  // Rate limit: 10 invites per hour
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
    const result = inviteMemberSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { firstName, lastName, email, roleId, fobId, locationId } = result.data

    // Check if user already exists
    const { data: existingUser } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      )
    }

    // Check for pending invitation
    const { data: existingInvite } = await supabase
      .from('user_invitations')
      .select('id')
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (existingInvite) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email' },
        { status: 409 }
      )
    }

    // Validate role assignment rules
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('name')
      .eq('id', roleId)
      .single()

    if (roleError || !role) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const roleName = (role as { name: string }).name
    if (roleName === 'fob_leader' && !fobId) {
      return NextResponse.json(
        { error: 'FOB Leader must be assigned to a FOB' },
        { status: 400 }
      )
    }

    if (roleName === 'pastor' && !locationId) {
      return NextResponse.json(
        { error: 'Pastor must be assigned to a location' },
        { status: 400 }
      )
    }

    // Generate secure invitation token
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create invitation record using admin client
    const { error: inviteError } = await adminSupabase
      .from('user_invitations')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        role_id: roleId,
        fob_id: roleName === 'admin' ? null : fobId || null,
        location_id: roleName === 'pastor' ? locationId : null,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })

    if (inviteError) throw inviteError

    // Send invitation email using Supabase Admin API
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { error: emailError } = await adminSupabase.auth.admin.inviteUserByEmail(
      email,
      {
        // Use client-side callback to handle hash-based invite tokens
        redirectTo: `${appUrl}/auth/callback`,
        data: {
          invitation_token: token,
          first_name: firstName,
          last_name: lastName,
        },
      }
    )

    if (emailError) {
      // Rollback invitation record
      await adminSupabase.from('user_invitations').delete().eq('token', token)
      throw emailError
    }

    await auditLog({
      action: 'TEAM_INVITE_SENT' as never,
      userId: user.id,
      ip,
      userAgent: getUserAgent(request),
      details: { invitedEmail: email, roleId, roleName },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    )
  }
}
