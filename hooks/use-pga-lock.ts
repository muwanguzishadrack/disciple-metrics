'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { isPgaReportDateLocked } from '@/components/pga/pga-lock'

/**
 * Number of days after the report date that entries stay editable for
 * non-admins (app_settings 'pga_edit_lock_days' via get_pga_lock_days()).
 * Resolves to null -- "no lock" -- when the RPC isn't deployed or fails, so the
 * app keeps today's behaviour until the DB side ships. The DB trigger remains
 * the real enforcement either way.
 */
export function usePgaLockDays() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['pga-lock-days'],
    queryFn: async (): Promise<number | null> => {
      try {
        const { data, error } = await (supabase as any).rpc('get_pga_lock_days')
        if (error || data === null || data === undefined) return null
        const days = typeof data === 'number' ? data : Number(data)
        return Number.isFinite(days) && days >= 0 ? days : null
      } catch {
        return null
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
}

/** Lock state for a report date. `lockDays` is null while loading / when unconfigured. */
export function usePgaReportLock(reportDate: string | null | undefined) {
  const { data: lockDays = null } = usePgaLockDays()
  return {
    lockDays,
    isLocked: isPgaReportDateLocked(reportDate, lockDays),
  }
}
