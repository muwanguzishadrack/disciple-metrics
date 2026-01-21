'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useRemoveMember } from '@/hooks/use-team'
import { useToast } from '@/hooks/use-toast'
import type { TeamMember } from '@/types'

interface RemoveMemberDialogProps {
  member: TeamMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RemoveMemberDialog({
  member,
  open,
  onOpenChange,
}: RemoveMemberDialogProps) {
  const { toast } = useToast()
  const removeMember = useRemoveMember()

  const handleRemove = async () => {
    if (!member) return

    try {
      await removeMember.mutateAsync(member.id)
      toast({
        title: 'Member removed',
        description: 'Team member has been removed successfully.',
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to remove member',
        variant: 'destructive',
      })
    }
  }

  const memberEmail = member?.email || 'this member'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {memberEmail} from the team? This
            action cannot be undone and will delete their account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={removeMember.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {removeMember.isPending ? 'Removing...' : 'Remove'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
