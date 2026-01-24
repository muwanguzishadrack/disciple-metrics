'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TeamMembersTable } from '@/components/team/team-members-table'
import { PendingInvitationsTable } from '@/components/team/pending-invitations-table'
import { InviteMemberDialog } from '@/components/team/invite-member-dialog'
import { useTeamMembers, useInvitations } from '@/hooks/use-team'
import { useUserRole } from '@/hooks/use-user'

export default function TeamPage() {
  const { data: userRole } = useUserRole()
  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'manager'
  const isAdminOrManager = isAdmin || isManager
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const { data: members, isLoading: membersLoading } = useTeamMembers()
  const { data: invitations, isLoading: invitationsLoading } = useInvitations()

  // Filter members by search and role
  const filteredMembers = useMemo(() => {
    return (members || []).filter((member) => {
      const matchesSearch =
        member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
      const matchesRole = roleFilter === 'all' || member.role?.name === roleFilter
      return matchesSearch && matchesRole
    })
  }, [members, searchQuery, roleFilter])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, roleFilter])

  // Pagination calculations
  const totalRows = filteredMembers.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedMembers = useMemo(
    () => filteredMembers.slice(startIndex, endIndex),
    [filteredMembers, startIndex, endIndex]
  )

  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value))
    setCurrentPage(1)
  }

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage your team members and their roles."
        actions={
          isAdmin && (
            <Button
              onClick={() => setInviteDialogOpen(true)}
              className="w-full sm:w-auto bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              Invite Member
            </Button>
          )
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
              canCancel={isAdmin}
              canResend={isAdmin}
            />
          </section>
        )}

        {/* Team Members Section */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Team Members</h2>

          {/* Search and Filter Controls */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Role Filter */}
            {isAdminOrManager && (
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {isAdmin && (
                    <>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </>
                  )}
                  <SelectItem value="fob_leader">FOB Leader</SelectItem>
                  <SelectItem value="pastor">Pastor</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <TeamMembersTable
            members={paginatedMembers}
            isLoading={membersLoading}
            userRole={userRole}
          />

          {/* Pagination */}
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Rows per page:
              </span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={handleRowsPerPageChange}
              >
                <SelectTrigger className="h-8 w-16 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <span className="mr-2 text-sm text-muted-foreground">
                {totalRows > 0
                  ? `${startIndex + 1}-${Math.min(endIndex, totalRows)} of ${totalRows}`
                  : '0 of 0'}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToFirstPage}
                disabled={currentPage === 1 || totalRows === 0}
              >
                <ChevronFirst className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToPreviousPage}
                disabled={currentPage === 1 || totalRows === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToNextPage}
                disabled={currentPage === totalPages || totalRows === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToLastPage}
                disabled={currentPage === totalPages || totalRows === 0}
              >
                <ChevronLast className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </div>

      <InviteMemberDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
      />
    </div>
  )
}
