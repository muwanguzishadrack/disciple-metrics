import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { auditLog } from '@/lib/audit-log'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const invitationToken = searchParams.get('invitation')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Handle invitation token if present
      if (invitationToken) {
        try {
          const adminSupabase = createAdminClient()

          // Find and validate invitation
          const { data: invitation, error: inviteError } = await adminSupabase
            .from('user_invitations')
            .select('*')
            .eq('token', invitationToken)
            .is('accepted_at', null)
            .gt('expires_at', new Date().toISOString())
            .single()

          if (!inviteError && invitation) {
            // Create user assignment based on invitation
            const { error: assignmentError } = await adminSupabase
              .from('user_assignments')
              .insert({
                user_id: data.user.id,
                role_id: invitation.role_id,
                fob_id: invitation.fob_id,
                location_id: invitation.location_id,
              })

            if (!assignmentError) {
              // Mark invitation as accepted
              await adminSupabase
                .from('user_invitations')
                .update({ accepted_at: new Date().toISOString() })
                .eq('id', invitation.id)

              // Audit log
              await auditLog({
                action: 'TEAM_INVITE_ACCEPTED' as never,
                userId: data.user.id,
                details: {
                  invitationId: invitation.id,
                  roleId: invitation.role_id,
                },
              })
            }
          }
        } catch (err) {
          console.error('Error processing invitation:', err)
          // Don't block login if invitation processing fails
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
