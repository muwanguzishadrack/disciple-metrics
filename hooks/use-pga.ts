'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from './use-user'
import type { Tables } from '@/types/supabase'

type Fob = Tables<'fobs'>
type Location = Tables<'locations'>

// Types for transformed data (used by usePgaReportByDate / detail page)
export interface LocationEntry {
  id: string
  fob: string
  fobId: string
  location: string
  locationId: string
  sv1: number
  sv2: number
  yxp: number
  kids: number
  local: number
  hc1: number
  hc2: number
  total: number
  salvations: number
  baptisms: number
  mca: number
  mechanics: number
}

export interface LocationEntryWithStatus extends Omit<LocationEntry, 'id' | 'sv1' | 'sv2' | 'yxp' | 'kids' | 'local' | 'hc1' | 'hc2' | 'total' | 'salvations' | 'baptisms' | 'mca' | 'mechanics'> {
  id: string | null
  sv1: number | null
  sv2: number | null
  yxp: number | null
  kids: number | null
  local: number | null
  hc1: number | null
  hc2: number | null
  total: number | null
  salvations: number | null
  baptisms: number | null
  mca: number | null
  mechanics: number | null
  hasSubmitted: boolean
}

// Kept for usePgaReportByDate (detail/edit page)
export interface PgaReportWithTotals {
  id: string
  date: string
  locations: LocationEntry[]
  totals: {
    sv1: number
    sv2: number
    yxp: number
    kids: number
    local: number
    hc1: number
    hc2: number
    total: number
    salvations: number
    baptisms: number
    mca: number
    mechanics: number
  }
}

// Flat summary row from pga_report_summary view
export interface PgaReportSummary {
  report_id: string
  date: string
  created_at: string
  sv1: number
  sv2: number
  yxp: number
  kids: number
  local: number
  hc1: number
  hc2: number
  total: number
  salvations: number
  baptisms: number
  mca: number
  mechanics: number
  epga_total: number
}

// Fetch all FOBs
export function useFobs() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['fobs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('fobs')
        .select('*')
        .order('name')
      if (error) throw error
      return data as Fob[]
    },
  })
}

// Fetch all locations with FOB info
export function useLocations() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('locations')
        .select(`
          *,
          fob:fobs (id, name)
        `)
        .order('name')
      if (error) throw error
      return data as (Location & { fob: { id: string; name: string } })[]
    },
  })
}

// Transform raw Supabase data to UI format (kept for usePgaReportByDate only)
function transformReportData(report: any): PgaReportWithTotals {
  const locations: LocationEntry[] = (report.pga_entries || []).map((entry: any) => {
    const sv1 = entry.sv1 || 0
    const sv2 = entry.sv2 || 0
    const yxp = entry.yxp || 0
    const kids = entry.kids || 0
    const local = entry.local || 0
    const hc1 = entry.hc1 || 0
    const hc2 = entry.hc2 || 0
    const total = sv1 + sv2 + yxp + kids + local + hc1 + hc2
    const salvations = entry.salvations || 0
    const baptisms = entry.baptisms || 0
    const mca = entry.mca || 0
    const mechanics = entry.mechanics || 0

    return {
      id: entry.id,
      fob: entry.location?.fob?.name || 'Unknown FOB',
      fobId: entry.location?.fob?.id || '',
      location: entry.location?.name || 'Unknown Location',
      locationId: entry.location_id,
      sv1, sv2, yxp, kids, local, hc1, hc2, total,
      salvations, baptisms, mca, mechanics,
    }
  })

  const totals = locations.reduce(
    (acc, entry) => ({
      sv1: acc.sv1 + entry.sv1,
      sv2: acc.sv2 + entry.sv2,
      yxp: acc.yxp + entry.yxp,
      kids: acc.kids + entry.kids,
      local: acc.local + entry.local,
      hc1: acc.hc1 + entry.hc1,
      hc2: acc.hc2 + entry.hc2,
      total: acc.total + entry.total,
      salvations: acc.salvations + entry.salvations,
      baptisms: acc.baptisms + entry.baptisms,
      mca: acc.mca + entry.mca,
      mechanics: acc.mechanics + entry.mechanics,
    }),
    { sv1: 0, sv2: 0, yxp: 0, kids: 0, local: 0, hc1: 0, hc2: 0, total: 0, salvations: 0, baptisms: 0, mca: 0, mechanics: 0 }
  )

  return { id: report.id, date: report.date, locations, totals }
}

// --- Query keys ---
const queryKeys = {
  pgaReportSummary: ['pga-report-summary'] as const,
  fourWeekPgaSummary: ['four-week-pga-summary'] as const,
  fourWeekEpgaSummary: ['four-week-epga-summary'] as const,
  epgaSummary: ['epga-summary'] as const,
  epgaDetail: (date: string | undefined) => ['epga-detail', date] as const,
  fourWeekPgaDetail: (date: string) => ['four-week-pga-detail', date] as const,
  fourWeekEpgaDetail: (date: string) => ['four-week-epga-detail', date] as const,
  pgaReport: (date?: string) => date ? ['pga-report', date] as const : ['pga-report'] as const,
}

// Fetch all PGA reports as flat summary rows from the view
export function usePgaReports() {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.pgaReportSummary,
    queryFn: async (): Promise<PgaReportSummary[]> => {
      const { data, error } = await (supabase as any)
        .from('pga_report_summary')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      return (data || []) as PgaReportSummary[]
    },
  })
}

// Fetch single PGA report by date (still fetches full entries for edit/delete)
export function usePgaReportByDate(date: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.pgaReport(date),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pga_reports')
        .select(`
          id,
          date,
          pga_entries (
            id,
            sv1, sv2, yxp, kids, local, hc1, hc2,
            salvations, baptisms, mca, mechanics,
            location_id,
            location:locations (
              id, name,
              fob:fobs (id, name)
            )
          )
        `)
        .eq('date', date)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows returned
        throw error
      }
      return transformReportData(data)
    },
    enabled: !!date,
  })
}

// --- Derived report hooks (now backed by views/RPCs) ---

export interface FourWeekRow {
  location: string
  locationId: string
  weekTotals: (number | null)[]
  average: number
}

export interface EpgaRow {
  location: string
  locationId: string
  sv1: number
  sv2: number
  yxp: number
  total: number
}

// Summary row for 4-week PGA listing (one row per report date)
export interface FourWeekPgaSummaryRow {
  reportId: string
  date: string
  weekTotals: (number | null)[]
  weekDates: (string | null)[]
  average: number
}

// Summary row for EPGA listing (one row per report date)
export interface EpgaSummaryRow {
  reportId: string
  date: string
  sv1: number
  sv2: number
  yxp: number
  total: number
}

// 4-week PGA summary from four_week_pga_summary view
export function useFourWeekPgaSummary() {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.fourWeekPgaSummary,
    queryFn: async (): Promise<FourWeekPgaSummaryRow[]> => {
      const { data, error } = await (supabase as any)
        .from('four_week_pga_summary')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error

      return (data || []).map((row: any): FourWeekPgaSummaryRow => ({
        reportId: row.report_id,
        date: row.date,
        weekTotals: [row.wk1_total ?? null, row.wk2_total ?? null, row.wk3_total ?? null, row.wk4_total ?? null],
        weekDates: [row.wk1_date ?? null, row.wk2_date ?? null, row.wk3_date ?? null, row.wk4_date ?? null],
        average: row.average ?? 0,
      }))
    },
  })
}

// EPGA summary from pga_report_summary view (select EPGA columns)
export function useEpgaSummary() {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.epgaSummary,
    queryFn: async (): Promise<EpgaSummaryRow[]> => {
      const { data, error } = await (supabase as any)
        .from('pga_report_summary')
        .select('report_id, date, sv1, sv2, yxp, epga_total')
        .order('date', { ascending: false })

      if (error) throw error

      return (data || []).map((row: any): EpgaSummaryRow => ({
        reportId: row.report_id,
        date: row.date,
        sv1: row.sv1,
        sv2: row.sv2,
        yxp: row.yxp,
        total: row.epga_total,
      }))
    },
  })
}

// 4-week EPGA summary from four_week_epga_summary view
export function useFourWeekEpgaSummary() {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.fourWeekEpgaSummary,
    queryFn: async (): Promise<FourWeekPgaSummaryRow[]> => {
      const { data, error } = await (supabase as any)
        .from('four_week_epga_summary')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error

      return (data || []).map((row: any): FourWeekPgaSummaryRow => ({
        reportId: row.report_id,
        date: row.date,
        weekTotals: [row.wk1_total ?? null, row.wk2_total ?? null, row.wk3_total ?? null, row.wk4_total ?? null],
        weekDates: [row.wk1_date ?? null, row.wk2_date ?? null, row.wk3_date ?? null, row.wk4_date ?? null],
        average: row.average ?? 0,
      }))
    },
  })
}

// 4-week PGA detail via RPC
export function useFourWeekPgaDetail(date: string) {
  const supabase = createClient()

  const { data: rpcData, isLoading } = useQuery({
    queryKey: queryKeys.fourWeekPgaDetail(date),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc('get_four_week_pga_detail', { p_date: date })

      if (error) throw error
      return data as {
        dates: string[]
        locations: { locationId: string; location: string; weekTotals: (number | null)[]; average: number }[]
        metricAverages: { sv1: number; sv2: number; yxp: number; kids: number; local: number; hc1: number; hc2: number; total: number } | null
      }
    },
    enabled: !!date,
  })

  return {
    data: (rpcData?.locations ?? []) as FourWeekRow[],
    dates: rpcData?.dates ?? [],
    metricAverages: rpcData?.metricAverages ?? null,
    isLoading,
  }
}

// 4-week EPGA detail via RPC
export function useFourWeekEpgaDetail(date: string) {
  const supabase = createClient()

  const { data: rpcData, isLoading } = useQuery({
    queryKey: queryKeys.fourWeekEpgaDetail(date),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .rpc('get_four_week_epga_detail', { p_date: date })

      if (error) throw error
      return data as {
        dates: string[]
        locations: { locationId: string; location: string; weekTotals: (number | null)[]; average: number }[]
        metricAverages: { sv1: number; sv2: number; yxp: number; total: number } | null
      }
    },
    enabled: !!date,
  })

  return {
    data: (rpcData?.locations ?? []) as FourWeekRow[],
    dates: rpcData?.dates ?? [],
    metricAverages: rpcData?.metricAverages ?? null,
    isLoading,
  }
}

// EPGA report for a specific date via RPC
export function useEpgaReport(date: string | undefined) {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.epgaDetail(date),
    queryFn: async (): Promise<EpgaRow[]> => {
      const { data, error } = await (supabase as any)
        .rpc('get_epga_detail', { p_date: date })

      if (error) throw error

      return ((data || []) as any[]).map((row: any): EpgaRow => ({
        location: row.location_name,
        locationId: row.location_id,
        sv1: row.sv1,
        sv2: row.sv2,
        yxp: row.yxp,
        total: row.total,
      }))
    },
    enabled: !!date,
  })
}

// --- Mutation hooks ---

interface CreatePgaEntryData {
  date: string
  locationId: string
  sv1: number
  sv2: number
  yxp: number
  kids: number
  local: number
  hc1: number
  hc2: number
  salvations: number
  baptisms: number
  mca: number
  mechanics: number
}

function invalidateAllPgaQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.pgaReportSummary })
  queryClient.invalidateQueries({ queryKey: queryKeys.epgaSummary })
  queryClient.invalidateQueries({ queryKey: queryKeys.fourWeekPgaSummary })
  queryClient.invalidateQueries({ queryKey: queryKeys.fourWeekEpgaSummary })
  queryClient.invalidateQueries({ queryKey: ['epga-detail'] })
  queryClient.invalidateQueries({ queryKey: ['four-week-pga-detail'] })
  queryClient.invalidateQueries({ queryKey: ['four-week-epga-detail'] })
  queryClient.invalidateQueries({ queryKey: ['pga-report'] })
}

export function useCreatePgaEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (data: CreatePgaEntryData) => {
      if (!user) throw new Error('Not authenticated')

      let reportId: string

      const { data: existingReport } = await (supabase as any)
        .from('pga_reports')
        .select('id')
        .eq('date', data.date)
        .maybeSingle()

      if (existingReport?.id) {
        reportId = existingReport.id
      } else {
        const { data: newReport, error: reportError } = await (supabase as any)
          .from('pga_reports')
          .insert({ date: data.date, created_by: user.id })
          .select('id')
          .single()

        if (reportError) throw reportError
        if (!newReport) throw new Error('Failed to create report')
        reportId = newReport.id
      }

      const { error: entryError } = await (supabase as any).from('pga_entries').insert({
        report_id: reportId,
        location_id: data.locationId,
        sv1: data.sv1,
        sv2: data.sv2,
        yxp: data.yxp,
        kids: data.kids,
        local: data.local,
        hc1: data.hc1,
        hc2: data.hc2,
        salvations: data.salvations,
        baptisms: data.baptisms,
        mca: data.mca,
        mechanics: data.mechanics,
        created_by: user.id,
      })

      if (entryError) throw entryError
    },
    onSuccess: () => {
      invalidateAllPgaQueries(queryClient)
    },
  })
}

// Update PGA entry
interface UpdatePgaEntryData {
  id: string
  sv1: number
  sv2: number
  yxp: number
  kids: number
  local: number
  hc1: number
  hc2: number
  salvations: number
  baptisms: number
  mca: number
  mechanics: number
}

export function useUpdatePgaEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdatePgaEntryData) => {
      const { error } = await (supabase as any)
        .from('pga_entries')
        .update({
          sv1: data.sv1,
          sv2: data.sv2,
          yxp: data.yxp,
          kids: data.kids,
          local: data.local,
          hc1: data.hc1,
          hc2: data.hc2,
          salvations: data.salvations,
          baptisms: data.baptisms,
          mca: data.mca,
          mechanics: data.mechanics,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateAllPgaQueries(queryClient)
    },
  })
}

// Delete PGA entry
export function useDeletePgaEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await (supabase as any)
        .from('pga_entries')
        .delete()
        .eq('id', entryId)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateAllPgaQueries(queryClient)
    },
  })
}

// Delete PGA report (and all its entries via cascade)
export function useDeletePgaReport() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await (supabase as any)
        .from('pga_reports')
        .delete()
        .eq('id', reportId)

      if (error) throw error
    },
    onSuccess: () => {
      invalidateAllPgaQueries(queryClient)
    },
  })
}
