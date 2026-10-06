'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { LocationWithFob } from '@/types'

interface CreateLocationData {
  name: string
  fobId: string
  pastor?: string | null
  contact?: string | null
}

interface UpdateLocationData {
  id: string
  name: string
  fobId: string
  pastor?: string | null
  contact?: string | null
}

export function useCreateLocation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateLocationData) => {
      const { error } = await (supabase as any).from('locations').insert({
        name: data.name,
        fob_id: data.fobId,
        pastor: data.pastor || null,
        contact: data.contact || null,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })
}

export function useUpdateLocation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateLocationData) => {
      const { error } = await (supabase as any)
        .from('locations')
        .update({
          name: data.name,
          fob_id: data.fobId,
          pastor: data.pastor || null,
          contact: data.contact || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })
}

// Archived locations (admin view on the Locations page). Shares the
// ['locations'] prefix so every location mutation refreshes it too.
export function useArchivedLocations(enabled = true) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['locations', 'archived'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('locations')
        .select(`
          *,
          fob:fobs (id, name, archived_at, region:regions (id, name))
        `)
        .not('archived_at', 'is', null)
        .order('name')
      if (error) throw error
      return data as ArchivedLocation[]
    },
    enabled,
  })
}

export type ArchivedLocation = LocationWithFob & {
  fob: LocationWithFob['fob'] & { archived_at: string | null }
}

function invalidateAfterArchiveChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['locations'] })
  // Missing-entries lists only count active locations
  queryClient.invalidateQueries({ queryKey: ['pga-missing-entries'] })
}

// RLS turns a disallowed UPDATE into a silent no-op, so read the row back.
// If it isn't readable we can't tell, and trust the update.
async function assertArchiveState(
  supabase: ReturnType<typeof createClient>,
  locationId: string,
  archived: boolean
) {
  const { data } = await (supabase as any)
    .from('locations')
    .select('archived_at')
    .eq('id', locationId)
    .maybeSingle()
  if (data && (data.archived_at !== null) !== archived) {
    throw new Error(
      `You do not have permission to ${archived ? 'archive' : 'restore'} this location.`
    )
  }
}

/**
 * Archive a location: it drops out of pickers and new reports, while every
 * past entry, assignment and invitation stays exactly as it was. Locations are
 * never hard-deleted from the app -- that used to wipe their PGA history.
 */
export function useArchiveLocation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (locationId: string) => {
      const now = new Date().toISOString()
      const { error } = await (supabase as any)
        .from('locations')
        .update({ archived_at: now, updated_at: now })
        .eq('id', locationId)
      if (error) throw error
      await assertArchiveState(supabase, locationId, true)
    },
    onSuccess: () => invalidateAfterArchiveChange(queryClient),
  })
}

/** Restore an archived location to the active list. */
export function useRestoreLocation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await (supabase as any)
        .from('locations')
        .update({ archived_at: null, updated_at: new Date().toISOString() })
        .eq('id', locationId)
      if (error) throw error
      await assertArchiveState(supabase, locationId, false)
    },
    onSuccess: () => invalidateAfterArchiveChange(queryClient),
  })
}
