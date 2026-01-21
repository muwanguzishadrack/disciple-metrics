import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit-log'

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient()

    // Get access token from Authorization header
    // This is more reliable than cookies when called immediately after setSession()
    const authHeader = request.headers.get('Authorization')
    const accessToken = authHeader?.replace('Bearer ', '')

    if (!accessToken) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
    }

    // Verify the token and get user directly (bypasses cookie dependency)
    const {
      data: { user },
      error: authError,
    } = await adminSupabase.auth.getUser(accessToken)

    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const { invitationToken } = await request.json()

    if (!invitationToken) {
      return NextResponse.json({ error: 'Missing invitation token' }, { status: 400 })
    }

    // Find and validate invitation
    const { data: invitation, error: inviteError } = await adminSupabase
      .from('user_invitations')
      .select('*')
      .eq('token', invitationToken)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      // Invitation might already be processed or expired
      return NextResponse.json({ success: true, message: 'Already processed' })
    }

    // Check if user already has an assignment
    const { data: existingAssignment } = await adminSupabase
      .from('user_assignments')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!existingAssignment) {
      // Create user assignment based on invitation
      // Note: valid_assignment constraint requires either:
      // - both fob_id and location_id NULL (org-level)
      // - only fob_id set (fob-level)
      // - only location_id set (location-level)
      // When both are provided, prefer location_id (more specific)
      const fobId = invitation.location_id ? null : invitation.fob_id
      const locationId = invitation.location_id

      const { error: assignmentError } = await adminSupabase
        .from('user_assignments')
        .insert({
          user_id: user.id,
          role_id: invitation.role_id,
          fob_id: fobId,
          location_id: locationId,
        })

      if (assignmentError) {
        console.error('Assignment error details:', {
          message: assignmentError.message,
          code: assignmentError.code,
          details: assignmentError.details,
          hint: assignmentError.hint,
          data: {
            user_id: user.id,
            role_id: invitation.role_id,
            fob_id: fobId,
            location_id: locationId,
          },
        })
        return NextResponse.json(
          { error: 'Failed to create user assignment' },
          { status: 500 }
        )
      }
    }

    // Mark invitation as accepted
    await adminSupabase
      .from('user_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // Audit log
    await auditLog({
      action: 'TEAM_INVITE_ACCEPTED' as never,
      userId: user.id,
      details: {
        invitationId: invitation.id,
        roleId: invitation.role_id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Accept invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to process invitation' },
      { status: 500 }
    )
  }
}
