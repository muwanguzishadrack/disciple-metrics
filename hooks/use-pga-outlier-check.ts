'use client'

import { useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PGA_METRIC_KEYS,
  PGA_METRICS,
  type PgaMetricValues,
} from '@/lib/validations/pga'
import {
  detectPgaOutliers,
  PGA_OUTLIER_HISTORY_SIZE,
  type PgaHistoryEntry,
  type PgaOutlierResult,
} from '@/components/pga/pga-outliers'
import { subtractDays } from '@/components/pga/pga-lock'

export interface PgaOutlierCheckResult extends PgaOutlierResult {
  /** How many past entries the comparison used. */
  historyCount: number
}

const NO_WARNINGS: PgaOutlierCheckResult = {
  spikes: [],
  droppedToZero: false,
  hasWarnings: false,
  historyCount: 0,
}

// Look back far enough to find 4 entries for a location that skips weeks,
// without pulling its whole history.
const LOOKBACK_DAYS = 180

/**
 * Returns a function that compares values about to be saved against the
 * location's last 4 entries before `reportDate`. Never throws: if the history
 * can't be read the save simply proceeds without a warning.
 */
export function usePgaOutlierCheck() {
  return useCallback(
    async (
      locationId: string,
      reportDate: string,
      values: PgaMetricValues
    ): Promise<PgaOutlierCheckResult> => {
      try {
        const supabase = createClient()
        const columns = PGA_METRIC_KEYS.map((key) => PGA_METRICS[key].column).join(', ')
        const { data, error } = await (supabase as any)
          .from('pga_entries')
          .select(`${columns}, pga_reports!inner (date)`)
          .eq('location_id', locationId)
          .lt('pga_reports.date', reportDate)
          .gte('pga_reports.date', subtractDays(reportDate, LOOKBACK_DAYS))
        if (error || !Array.isArray(data)) return NO_WARNINGS

        const history: PgaHistoryEntry[] = (data as any[])
          .filter((row) => row.pga_reports?.date)
          .sort((a, b) => (a.pga_reports.date < b.pga_reports.date ? 1 : -1))
          .slice(0, PGA_OUTLIER_HISTORY_SIZE)
          .map((row) => {
            const entry: PgaHistoryEntry = {}
            for (const key of PGA_METRIC_KEYS) entry[key] = row[PGA_METRICS[key].column]
            return entry
          })

        return { ...detectPgaOutliers(values, history), historyCount: history.length }
      } catch {
        return NO_WARNINGS
      }
    },
    []
  )
}
