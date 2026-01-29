'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUser } from './use-user'
import type { Tables } from '@/types/supabase'

type Fob = Tables<'fobs'>
type Location = Tables<'locations'>

// Types for transformed data
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
  // Ministry Impact metrics (not included in PGA total)
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
  // Ministry Impact metrics (not included in PGA total)
  salvations: number | null
  baptisms: number | null
  mca: number | null
  mechanics: number | null
  hasSubmitted: boolean
}

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
    // Ministry Impact totals (not included in PGA total)
    salvations: number
    baptisms: number
    mca: number
    mechanics: number
  }
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

// Helper to calculate totals
function calculateTotals(entries: LocationEntry[]) {
  return entries.reduce(
    (acc, entry) => ({
      sv1: acc.sv1 + entry.sv1,
      sv2: acc.sv2 + entry.sv2,
      yxp: acc.yxp + entry.yxp,
      kids: acc.kids + entry.kids,
      local: acc.local + entry.local,
      hc1: acc.hc1 + entry.hc1,
      hc2: acc.hc2 + entry.hc2,
      total: acc.total + entry.total,
      // Ministry Impact totals (not included in PGA total)
      salvations: acc.salvations + entry.salvations,
      baptisms: acc.baptisms + entry.baptisms,
      mca: acc.mca + entry.mca,
      mechanics: acc.mechanics + entry.mechanics,
    }),
    { sv1: 0, sv2: 0, yxp: 0, kids: 0, local: 0, hc1: 0, hc2: 0, total: 0, salvations: 0, baptisms: 0, mca: 0, mechanics: 0 }
  )
}

// Transform raw Supabase data to UI format
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
    // Ministry Impact metrics (not included in PGA total)
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
      sv1,
      sv2,
      yxp,
      kids,
      local,
      hc1,
      hc2,
      total,
      salvations,
      baptisms,
      mca,
      mechanics,
    }
  })

  return {
    id: report.id,
    date: report.date,
    locations,
    totals: calculateTotals(locations),
  }
}

// Fetch all PGA reports with aggregated totals
export function usePgaReports() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['pga-reports'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pga_reports')
        .select(`
          id,
          date,
          created_at,
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
        .order('date', { ascending: false })

      if (error) throw error
      return (data || []).map(transformReportData)
    },
  })
}

// Fetch single PGA report by date
export function usePgaReportByDate(date: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['pga-report', date],
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

// Create PGA report entry
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
  // Ministry Impact metrics (not included in PGA total)
  salvations: number
  baptisms: number
  mca: number
  mechanics: number
}

export function useCreatePgaEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (data: CreatePgaEntryData) => {
      if (!user) throw new Error('Not authenticated')

      // First, get or create the report for this date
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

      // Now create the entry
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
      queryClient.invalidateQueries({ queryKey: ['pga-reports'] })
      queryClient.invalidateQueries({ queryKey: ['pga-report'] })
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
  // Ministry Impact metrics (not included in PGA total)
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
      queryClient.invalidateQueries({ queryKey: ['pga-reports'] })
      queryClient.invalidateQueries({ queryKey: ['pga-report'] })
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
      queryClient.invalidateQueries({ queryKey: ['pga-reports'] })
      queryClient.invalidateQueries({ queryKey: ['pga-report'] })
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
      queryClient.invalidateQueries({ queryKey: ['pga-reports'] })
      queryClient.invalidateQueries({ queryKey: ['pga-report'] })
    },
  })
}
