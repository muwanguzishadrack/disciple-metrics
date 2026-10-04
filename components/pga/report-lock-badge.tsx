'use client'

import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pgaLockMessage } from './pga-lock'

interface ReportLockBadgeProps {
  lockDays: number
  isAdmin: boolean
  className?: string
}

/**
 * Shown on a report past its edit window. Non-admins get a "Locked" badge;
 * admins a subtler "Locked (admin override)" since they can still edit.
 * The tooltip is the native title attribute (no tooltip primitive installed),
 * and is mirrored to screen readers via aria-label.
 */
export function ReportLockBadge({ lockDays, isAdmin, className }: ReportLockBadgeProps) {
  const message = pgaLockMessage(lockDays)
  return (
    <span
      title={message}
      aria-label={`${isAdmin ? 'Locked (admin override)' : 'Locked'}. ${message}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 align-middle text-xs font-medium',
        isAdmin
          ? 'border-[hsl(var(--header-fg)/0.3)] text-[hsl(var(--header-fg)/0.7)]'
          : 'border-amber-500/60 bg-amber-500/15 text-[hsl(var(--header-fg))]',
        className
      )}
    >
      <Lock className="h-3 w-3" />
      {isAdmin ? 'Locked (admin override)' : 'Locked'}
    </span>
  )
}
