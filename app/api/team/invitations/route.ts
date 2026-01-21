import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TeamInvitation } from '@/types'

export async function GET() {
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

    // Fetch pending invitations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invitations, error } = await (supabase as any)
      .from('user_invitations')
      .select(
        `
        id,
        email,
        expires_at,
        created_at,
        role:roles (id, name),
        fob:fobs (id, name),
        location:locations (id, name),
        inviter:profiles!invited_by (id, email)
      `
      )
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform data to TeamInvitation format
    const transformedInvitations: TeamInvitation[] = (invitations || []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (invite: any) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role!,
        fob: invite.fob || null,
        location: invite.location || null,
        invitedBy: {
          id: invite.inviter?.id || '',
          email: invite.inviter?.email || null,
        },
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
      })
    )

    return NextResponse.json({ invitations: transformedInvitations })
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
}
