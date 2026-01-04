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
import { useDeleteLocation } from '@/hooks/use-locations'
import { useToast } from '@/hooks/use-toast'
import type { LocationWithFob } from '@/types'

interface DeleteLocationDialogProps {
  location: LocationWithFob | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteLocationDialog({
  location,
  open,
  onOpenChange,
}: DeleteLocationDialogProps) {
  const { toast } = useToast()
  const deleteLocation = useDeleteLocation()

  const handleDelete = async () => {
    if (!location) return

    try {
      await deleteLocation.mutateAsync(location.id)
      toast({
        title: 'Location deleted',
        description: 'The location has been deleted successfully.',
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete location',
        variant: 'destructive',
      })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Location</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{location?.name}&quot;? This
            action cannot be undone. Any PGA entries associated with this
            location will also be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteLocation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteLocation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
