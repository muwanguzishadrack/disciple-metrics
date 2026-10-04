'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { shouldRetryRpc } from '@/components/analytics/rpc-errors'
import { analyticsKeys } from './use-analytics'

// Admin-only audit/restore RPCs. The RPCs enforce the admin check themselves;
// callers also gate on role so non-admins never fire them.

export const activityKeys = {
  changeLog: ['pga-change-log'] as const,
  deletedReports: ['deleted-pga-reports'] as const,
  deletedEntries: ['deleted-pga-entries'] as const,
}

export interface ChangeLogRow {
  id: number
  table_name: 'pga_entries' | 'pga_reports' | string
  row_id: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE' | string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  changed_by_name: string | null
  changed_at: string
  report_date: string | null
  location_id: string | null
  location_name: string | null
  total_count: number | string | null
}

export interface DeletedReportRow {
  report_id: string
  report_date: string
  deleted_at: string
  deleted_by: string | null
  deleted_by_name: string | null
  entry_count: number | null
}

export interface DeletedEntryRow {
  log_id: number
  entry_id: string
  report_id: string
  report_date: string
  location_id: string
  location_name: string | null
  deleted_at: string
  deleted_by: string | null
  deleted_by_name: string | null
  report_exists: boolean
}

export interface ChangeLogParams {
  from?: string | null
  to?: string | null
  locationId?: string | null
  limit: number
  offset: number
}

export function usePgaChangeLog(params: ChangeLogParams, enabled: boolean) {
  const supabase = createClient()

  return useQuery({
    queryKey: [
      ...activityKeys.changeLog,
      params.from ?? null,
      params.to ?? null,
      params.locationId ?? null,
      params.limit,
      params.offset,
    ],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_pga_change_log', {
        p_from: params.from || null,
        p_to: params.to || null,
        p_location_id: params.locationId || null,
        p_limit: params.limit,
        p_offset: params.offset,
      })
      if (error) throw error
      const rows = (data ?? []) as ChangeLogRow[]
      const total = rows.length > 0 ? Number(rows[0].total_count ?? rows.length) : 0
      return { rows, total }
    },
    enabled,
    retry: shouldRetryRpc,
    placeholderData: (prev) => prev,
  })
}

export function useDeletedPgaReports(enabled: boolean) {
  const supabase = createClient()

  return useQuery({
    queryKey: activityKeys.deletedReports,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_deleted_pga_reports')
      if (error) throw error
      return (data ?? []) as DeletedReportRow[]
    },
    enabled,
    retry: shouldRetryRpc,
  })
}

export function useDeletedPgaEntries(enabled: boolean, limit = 100) {
  const supabase = createClient()

  return useQuery({
    queryKey: [...activityKeys.deletedEntries, limit],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_deleted_pga_entries', {
        p_limit: limit,
      })
      if (error) throw error
      return (data ?? []) as DeletedEntryRow[]
    },
    enabled,
    retry: shouldRetryRpc,
  })
}

// Every key that shows PGA numbers. The pga-* / *-summary / *-detail keys match
// the queryKeys in hooks/use-pga.ts (invalidateAllPgaQueries); prefix matching
// covers their parameterised variants.
const PGA_DATA_KEYS: readonly (readonly string[])[] = [
  ['pga-report-summary'],
  ['epga-summary'],
  ['salvation-summary'],
  ['mechanics-summary'],
  ['four-week-pga-summary'],
  ['four-week-epga-summary'],
  ['epga-detail'],
  ['four-week-pga-detail'],
  ['four-week-epga-detail'],
  ['pga-report'],
  ['pga-reports'],
  analyticsKeys.trend,
  analyticsKeys.periodTotals,
  activityKeys.changeLog,
  activityKeys.deletedReports,
  activityKeys.deletedEntries,
]

function invalidateAfterRestore(queryClient: ReturnType<typeof useQueryClient>) {
  PGA_DATA_KEYS.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey: [...queryKey] })
  })
}

export function useRestorePgaReport() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reportId: string): Promise<number> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('restore_pga_report', {
        p_report_id: reportId,
      })
      if (error) throw error
      return Number(data ?? 0)
    },
    onSuccess: () => invalidateAfterRestore(queryClient),
  })
}

export function useRestorePgaEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (logId: number): Promise<string | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('restore_pga_entry', {
        p_log_id: logId,
      })
      if (error) throw error
      return (data as string | null) ?? null
    },
    onSuccess: () => invalidateAfterRestore(queryClient),
  })
}
