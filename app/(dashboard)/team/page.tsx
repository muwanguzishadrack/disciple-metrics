'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { TeamMembersTable } from '@/components/team/team-members-table'
import { PendingInvitationsTable } from '@/components/team/pending-invitations-table'
import { InviteMemberDialog } from '@/components/team/invite-member-dialog'
import { useTeamMembers, useInvitations } from '@/hooks/use-team'

export default function TeamPage() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const { data: members, isLoading: membersLoading } = useTeamMembers()
  const { data: invitations, isLoading: invitationsLoading } = useInvitations()

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage your team members and their roles."
        actions={
          <Button
            onClick={() => setInviteDialogOpen(true)}
            className="w-full sm:w-auto bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            Invite Member
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6">
        {/* Pending Invitations Section */}
        {((invitations && invitations.length > 0) || invitationsLoading) && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">Pending Invitations</h2>
            <PendingInvitationsTable
              invitations={invitations || []}
              isLoading={invitationsLoading}
            />
          </section>
        )}

        {/* Team Members Section */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Team Members</h2>
          <TeamMembersTable
            members={members || []}
            isLoading={membersLoading}
          />
        </section>
      </div>

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  )
}
