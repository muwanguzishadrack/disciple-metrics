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
import { useArchiveLocation, useRestoreLocation } from '@/hooks/use-locations'
import { useToast } from '@/hooks/use-toast'
import type { LocationWithFob } from '@/types'

interface ArchiveLocationDialogProps {
  mode: 'archive' | 'restore'
  location: LocationWithFob | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArchiveLocationDialog({
  mode,
  location,
  open,
  onOpenChange,
}: ArchiveLocationDialogProps) {
  const { toast } = useToast()
  const archiveLocation = useArchiveLocation()
  const restoreLocation = useRestoreLocation()
  const mutation = mode === 'archive' ? archiveLocation : restoreLocation
  const isArchive = mode === 'archive'

  const handleConfirm = async (e: React.MouseEvent) => {
    // Keep the dialog open until the request settles
    e.preventDefault()
    if (!location) return

    try {
      await mutation.mutateAsync(location.id)
      toast({
        title: isArchive ? 'Location archived' : 'Location restored',
        description: isArchive
          ? `"${location.name}" has been archived. Its past reports are unchanged.`
          : `"${location.name}" is active again and can receive new entries.`,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : `Failed to ${isArchive ? 'archive' : 'restore'} location`,
        variant: 'destructive',
      })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isArchive ? 'Archive Location' : 'Restore Location'}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            {isArchive ? (
              <div className="space-y-2">
                <p>Archive &quot;{location?.name}&quot;?</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>It will no longer appear in location pickers or count as missing from new reports.</li>
                  <li>All of its past PGA entries stay in historical reports, unchanged.</li>
                  <li>Team members assigned to it keep their accounts; reassign them from Team if needed.</li>
                </ul>
                <p>You can restore it at any time from the archived list.</p>
              </div>
            ) : (
              <p>
                Restore &quot;{location?.name}&quot;? It will appear in location pickers again and
                be expected in new reports.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending
              ? isArchive
                ? 'Archiving...'
                : 'Restoring...'
              : isArchive
                ? 'Archive'
                : 'Restore'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
