'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EditMemberDialog } from './edit-member-dialog'
import { RemoveMemberDialog } from './remove-member-dialog'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { ROLE_DISPLAY_NAMES, type RoleName, type TeamMember } from '@/types'
import { format } from 'date-fns'

interface TeamMembersTableProps {
  members: TeamMember[]
  isLoading: boolean
}

export function TeamMembersTable({ members, isLoading }: TeamMembersTableProps) {
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [removeMember, setRemoveMember] = useState<TeamMember | null>(null)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const formatRoleName = (name: string) => {
    return ROLE_DISPLAY_NAMES[name as RoleName] || name
  }

  const getAssignment = (member: TeamMember) => {
    const roleName = member.role?.name
    if (roleName === 'admin') {
      return 'Organisation wide'
    }
    if (roleName === 'fob_leader') {
      return member.fob?.name || '-'
    }
    if (roleName === 'pastor') {
      return member.location?.name || '-'
    }
    return '-'
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assignment</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  {member.firstName || member.lastName
                    ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
                    : '-'}
                </TableCell>
                <TableCell>{member.email || '-'}</TableCell>
                <TableCell>
                  {member.role ? formatRoleName(member.role.name) : '-'}
                </TableCell>
                <TableCell>{getAssignment(member)}</TableCell>
                <TableCell>
                  {member.createdAt
                    ? format(new Date(member.createdAt), 'MMM d, yyyy')
                    : '-'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditMember(member)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Role
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setRemoveMember(member)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  No team members found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <EditMemberDialog
        member={editMember}
        open={!!editMember}
        onOpenChange={(open) => !open && setEditMember(null)}
      />

      <RemoveMemberDialog
        member={removeMember}
        open={!!removeMember}
        onOpenChange={(open) => !open && setRemoveMember(null)}
      />
    </>
  )
}
