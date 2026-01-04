'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

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

export function useDeleteLocation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await (supabase as any)
        .from('locations')
        .delete()
        .eq('id', locationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    },
  })
}
