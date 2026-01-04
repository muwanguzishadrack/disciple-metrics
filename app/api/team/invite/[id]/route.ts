import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { auditLog, getUserAgent } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invitationId } = await params
  const ip = getClientIp(request)

  try {
    const supabase = await createClient()

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

    // Get invitation details for audit log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitation } = await (supabase as any)
      .from('user_invitations')
      .select('email')
      .eq('id', invitationId)
      .single()

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      )
    }

    // Delete the invitation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any)
      .from('user_invitations')
      .delete()
      .eq('id', invitationId)

    if (deleteError) throw deleteError

    await auditLog({
      action: 'TEAM_INVITE_CANCELLED' as never,
      userId: user.id,
      ip,
      userAgent: getUserAgent(request),
      details: { invitationId, cancelledEmail: (invitation as { email: string }).email },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel invitation error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel invitation' },
      { status: 500 }
    )
  }
}
