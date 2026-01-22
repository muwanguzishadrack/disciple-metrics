'use client'

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
import { useResendInvite, useCancelInvite } from '@/hooks/use-team'
import { useToast } from '@/hooks/use-toast'
import { MoreHorizontal, RefreshCw, X } from 'lucide-react'
import { ROLE_DISPLAY_NAMES, type RoleName, type TeamInvitation } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface PendingInvitationsTableProps {
  invitations: TeamInvitation[]
  isLoading: boolean
}

export function PendingInvitationsTable({
  invitations,
  isLoading,
}: PendingInvitationsTableProps) {
  const { toast } = useToast()
  const resendInvite = useResendInvite()
  const cancelInvite = useCancelInvite()

  const handleResend = async (invitation: TeamInvitation) => {
    try {
      await resendInvite.mutateAsync(invitation.id)
      toast({
        title: 'Invitation resent',
        description: `A new invitation has been sent to ${invitation.email}`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to resend invitation',
        variant: 'destructive',
      })
    }
  }

  const handleCancel = async (invitation: TeamInvitation) => {
    try {
      await cancelInvite.mutateAsync(invitation.id)
      toast({
        title: 'Invitation cancelled',
        description: `The invitation to ${invitation.email} has been cancelled.`,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to cancel invitation',
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const formatRoleName = (name: string) => {
    return ROLE_DISPLAY_NAMES[name as RoleName] || name
  }

  return (
    <div className="rounded-md border">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Email</TableHead>
            <TableHead className="w-[15%]">Role</TableHead>
            <TableHead className="w-[15%]">FOB</TableHead>
            <TableHead className="w-[15%]">Location</TableHead>
            <TableHead className="w-[15%]">Expires</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>{invitation.email}</TableCell>
              <TableCell>{formatRoleName(invitation.role.name)}</TableCell>
              <TableCell>{invitation.fob?.name || '-'}</TableCell>
              <TableCell>{invitation.location?.name || '-'}</TableCell>
              <TableCell>
                {formatDistanceToNow(new Date(invitation.expiresAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleResend(invitation)}
                      disabled={resendInvite.isPending}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleCancel(invitation)}
                      disabled={cancelInvite.isPending}
                      className="text-destructive"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {invitations.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground"
              >
                No pending invitations.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
