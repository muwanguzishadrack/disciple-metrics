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
import type { PendingOutlierConfirmation } from '@/hooks/use-pga-entry-form'
import { formatPgaOutlierFlag } from './pga-outliers'

interface PgaOutlierConfirmDialogProps {
  pending: PendingOutlierConfirmation | null
  onCancel: () => void
  locationName?: string | null
}

/** "These numbers look unusual" confirm step before saving a PGA entry. */
export function PgaOutlierConfirmDialog({
  pending,
  onCancel,
  locationName,
}: PgaOutlierConfirmDialogProps) {
  const result = pending?.result
  const weeks = result?.historyCount || 4

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Double-check these numbers</AlertDialogTitle>
          <AlertDialogDescription>
            Compared with {locationName ? `${locationName}'s` : 'this location’s'} last{' '}
            {weeks === 1 ? 'entry' : `${weeks} entries`}, some values look unusual. Please
            confirm they are correct before saving.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {result && (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {result.spikes.map((flag) => (
              <li key={flag.key}>{formatPgaOutlierFlag(flag, weeks)}</li>
            ))}
            {result.droppedToZero && (
              <li>Every value is 0, but this location reported activity recently.</li>
            )}
          </ul>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Go back</AlertDialogCancel>
          <AlertDialogAction onClick={() => pending?.onConfirm()}>Save anyway</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
