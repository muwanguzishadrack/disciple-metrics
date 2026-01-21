'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'

export type RoleName = 'admin' | 'fob_leader' | 'pastor' | null

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
  theme?: string | null
  updated_at?: string
}

export function useUpdateProfile() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: user } = useUser()

  return useMutation({
    mutationFn: async (data: Partial<Pick<Profile, 'theme'>>) => {
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

export function useUserRole() {
  const supabase = createClient()
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_user_role', {
        p_user_id: user.id,
      })
      if (error) throw error
      return data as RoleName
    },
    enabled: !!user,
  })
}

export type UserAssignment = {
  role: string
  roleName: string
  fobName?: string
  locationName?: string
}

export function useUserAssignment() {
  const supabase = createClient()
  const { data: user } = useUser()

  return useQuery({
    queryKey: ['user-assignment', user?.id],
    queryFn: async (): Promise<UserAssignment | null> => {
      if (!user) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('user_assignments')
        .select(`
          role_id,
          roles!inner(name),
          fobs(name),
          locations(name)
        `)
        .eq('user_id', user.id)
        .single()
      if (error) throw error
      if (!data) return null

      const roleName = data.roles?.name || 'Unknown'
      const displayRoleName =
        roleName === 'admin'
          ? 'Admin'
          : roleName === 'fob_leader'
            ? 'FOB Leader'
            : roleName === 'pastor'
              ? 'Pastor'
              : roleName

      return {
        role: roleName,
        roleName: displayRoleName,
        fobName: data.fobs?.name,
        locationName: data.locations?.name,
      }
    },
    enabled: !!user,
  })
}
