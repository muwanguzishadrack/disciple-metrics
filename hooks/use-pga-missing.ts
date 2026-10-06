'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface MissingPgaEntry {
  location_id: string
  location_name: string
  fob_id: string | null
  fob_name: string | null
  region_id: string | null
  region_name: string | null
}

/**
 * Active locations with no entry for the report on `reportDate`
 * (get_missing_pga_entries; security invoker, so RLS scopes fob_leaders to
 * their FOB). Errors -- including the RPC not being deployed yet -- surface
 * as `isError`, and callers hide the card.
 */
export function useMissingPgaEntries(reportDate: string | null | undefined, enabled = true) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['pga-missing-entries', reportDate],
    queryFn: async (): Promise<MissingPgaEntry[]> => {
      const { data, error } = await (supabase as any).rpc('get_missing_pga_entries', {
        p_report_date: reportDate,
      })
      if (error) throw error
      return (data ?? []) as MissingPgaEntry[]
    },
    enabled: enabled && !!reportDate,
    retry: false,
  })
}
