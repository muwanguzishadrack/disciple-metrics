import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TeamMember } from '@/types'

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

    // Use admin client for data queries to bypass RLS for nested relations
    const adminSupabase = createAdminClient()

    // Fetch all team members with their roles and locations
    const { data: profiles, error } = await adminSupabase
      .from('profiles')
      .select(
        `
        id,
        email,
        first_name,
        last_name,
        created_at,
        user_assignments (
          role:roles (id, name, description),
          fob:fobs (id, name),
          location:locations (id, name, fob_id)
        )
      `
      )
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform data to TeamMember format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const members: TeamMember[] = (profiles || []).map((profile: any) => {
      // user_assignments is an object (one-to-one relationship due to UNIQUE constraint)
      const assignment = profile.user_assignments
      return {
        id: profile.id,
        email: profile.email,
        firstName: profile.first_name,
        lastName: profile.last_name,
        role: assignment?.role || null,
        fob: assignment?.fob || null,
        location: assignment?.location || null,
        createdAt: profile.created_at,
      }
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    )
  }
}
