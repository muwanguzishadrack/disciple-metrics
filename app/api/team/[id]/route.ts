import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateMemberSchema } from '@/lib/validations/team'
import { auditLog, getUserAgent } from '@/lib/audit-log'
import { getClientIp } from '@/lib/rate-limit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params
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

    // Check if user is admin or manager
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isAdminOrManager } = await (supabase as any).rpc('is_admin_or_manager', {
      p_user_id: user.id,
    })
    if (!isAdminOrManager) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if user is specifically admin (not just admin_or_manager)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isAdmin } = await (supabase as any).rpc('is_admin', {
      p_user_id: user.id,
    })

    // If user is manager (not admin), restrict which members they can edit
    if (!isAdmin) {
      const adminSupabase = createAdminClient()

      // Get target member's current role
      const { data: targetAssignment } = await adminSupabase
        .from('user_assignments')
        .select('role_id, roles(name)')
        .eq('user_id', memberId)
        .single()

      const targetRoleName = (targetAssignment?.roles as { name: string } | null)?.name

      // Manager can only edit fob_leader and pastor members
      if (targetRoleName && !['fob_leader', 'pastor'].includes(targetRoleName)) {
        return NextResponse.json(
          { error: 'Managers can only edit FOB leaders and pastors' },
          { status: 403 }
        )
      }
    }

    // Prevent user from changing their own role
    if (memberId === user.id) {
      return NextResponse.json(
        { error: 'Cannot modify your own role' },
        { status: 400 }
      )
    }

    // Validate input
    const body = await request.json()
    const result = updateMemberSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const { roleId, fobId, locationId } = result.data

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

    // If user is manager, prevent assigning admin or manager roles
    if (!isAdmin && ['admin', 'manager'].includes(roleName)) {
      return NextResponse.json(
        { error: 'Managers cannot assign admin or manager roles' },
        { status: 403 }
      )
    }

    // Use admin client to update assignment (bypasses RLS for cross-user updates)
    const adminSupabase = createAdminClient()

    // Check if assignment exists
    const { data: existingAssignment } = await adminSupabase
      .from('user_assignments')
      .select('id')
      .eq('user_id', memberId)
      .maybeSingle()

    if (existingAssignment) {
      // Update existing assignment
      // Note: valid_assignment constraint requires only ONE of fob_id or location_id to be set
      const { error: updateError } = await adminSupabase
        .from('user_assignments')
        .update({
          role_id: roleId,
          fob_id: roleName === 'fob_leader' ? fobId : null,
          location_id: roleName === 'pastor' ? locationId : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', memberId)

      if (updateError) throw updateError
    } else {
      // Create new assignment
      // Note: valid_assignment constraint requires only ONE of fob_id or location_id to be set
      const { error: insertError } = await adminSupabase
        .from('user_assignments')
        .insert({
          user_id: memberId,
          role_id: roleId,
          fob_id: roleName === 'fob_leader' ? fobId : null,
          location_id: roleName === 'pastor' ? locationId : null,
        })

      if (insertError) throw insertError
    }

    await auditLog({
      action: 'TEAM_MEMBER_UPDATED' as never,
      userId: user.id,
      ip,
      userAgent: getUserAgent(request),
      details: { memberId, roleId, fobId, locationId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update member error:', error)
    return NextResponse.json(
      { error: 'Failed to update team member' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: memberId } = await params
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

    // Prevent admin from deleting themselves
    if (memberId === user.id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself from the team' },
        { status: 400 }
      )
    }

    // Use admin client to delete user
    const adminSupabase = createAdminClient()

    // Delete user from auth.users (cascades to profiles and user_assignments)
    const { error: deleteError } =
      await adminSupabase.auth.admin.deleteUser(memberId)

    if (deleteError) throw deleteError

    await auditLog({
      action: 'TEAM_MEMBER_REMOVED' as never,
      userId: user.id,
      ip,
      userAgent: getUserAgent(request),
      details: { removedMemberId: memberId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove member error:', error)
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    )
  }
}
