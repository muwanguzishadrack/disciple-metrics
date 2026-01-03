'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Fob, Location } from '@/types/supabase'
import type { PublicPgaSubmissionData } from '@/lib/validations/pga'

// Fetch FOBs (public access via RLS anon policy)
export function usePublicFobs() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['public-fobs'],
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

// Fetch Locations with FOB info (public access via RLS anon policy)
export function usePublicLocations() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['public-locations'],
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

// Submit PGA via public API
export function usePublicPgaSubmission() {
  return useMutation({
    mutationFn: async (data: PublicPgaSubmissionData) => {
      const response = await fetch('/api/pga/public-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Submission failed')
      }

      return result
    },
  })
}
