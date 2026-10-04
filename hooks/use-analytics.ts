'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldRetryRpc } from '@/components/analytics/rpc-errors'
import type { GroupBy, PeriodTotalsRow } from '@/components/analytics/compare'
import type { DateRange } from '@/components/analytics/periods'

// Both RPCs are SECURITY INVOKER, so RLS scopes the numbers to what the caller
// can already see (pastor: own location; FOB leader: own FOB; admin/manager: all).

export const analyticsKeys = {
  trend: ['pga-trend'] as const,
  periodTotals: ['pga-period-totals'] as const,
}

/** One row per report date from rpc('get_pga_trend'); metric keys read defensively */
export type TrendRow = Record<string, unknown> & {
  report_date: string
  entry_count?: number | null
}

export interface TrendScope {
  regionId?: string | null
  fobId?: string | null
  locationId?: string | null
}

export function usePgaTrend(range: DateRange | null, scope: TrendScope) {
  const supabase = createClient()

  return useQuery({
    queryKey: [
      ...analyticsKeys.trend,
      range?.start,
      range?.end,
      scope.regionId ?? null,
      scope.fobId ?? null,
      scope.locationId ?? null,
    ],
    queryFn: async (): Promise<TrendRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pga_trend', {
        p_start: range!.start,
        p_end: range!.end,
        p_region_id: scope.regionId || null,
        p_fob_id: scope.fobId || null,
        p_location_id: scope.locationId || null,
      })
      if (error) throw error
      return ((data ?? []) as TrendRow[])
        .filter((r) => !!r?.report_date)
        .sort((a, b) => a.report_date.localeCompare(b.report_date))
    },
    enabled: !!range,
    retry: shouldRetryRpc,
  })
}

export function usePgaPeriodTotals(range: DateRange | null, groupBy: GroupBy) {
  const supabase = createClient()

  return useQuery({
    queryKey: [...analyticsKeys.periodTotals, range?.start, range?.end, groupBy],
    queryFn: async (): Promise<PeriodTotalsRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pga_period_totals', {
        p_start: range!.start,
        p_end: range!.end,
        p_group_by: groupBy,
      })
      if (error) throw error
      return (data ?? []) as PeriodTotalsRow[]
    },
    enabled: !!range,
    retry: shouldRetryRpc,
  })
}
