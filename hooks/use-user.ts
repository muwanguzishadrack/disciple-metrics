'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

export function useUser() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },
  })
}

export function useProfile() {
  const supabase = createClient()
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!user,
  })
}

type ProfileUpdateData = {
  first_name?: string | null
  last_name?: string | null
  theme?: string | null
  updated_at?: string
}

export function useUpdateProfile() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (
      data: Partial<Pick<Profile, 'first_name' | 'last_name' | 'theme'>>
    ) => {
      if (!user) throw new Error('Not authenticated')
      const updateData: ProfileUpdateData = {
        ...data,
        updated_at: new Date().toISOString(),
      }
      const { error } = await (supabase as any)
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}
