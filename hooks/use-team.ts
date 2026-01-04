'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type {
  TeamMember,
  TeamInvitation,
  InviteMemberData,
  UpdateMemberData,
} from '@/types'
import type { Role } from '@/types/supabase'

// Fetch team members
export function useTeamMembers() {
  return useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const response = await fetch('/api/team')
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch team')
      }
      const data = await response.json()
      return data.members as TeamMember[]
    },
  })
}

// Fetch pending invitations
export function useInvitations() {
  return useQuery({
    queryKey: ['team-invitations'],
    queryFn: async () => {
      const response = await fetch('/api/team/invitations')
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch invitations')
      }
      const data = await response.json()
      return data.invitations as TeamInvitation[]
    },
  })
}

// Fetch roles for dropdown
export function useRoles() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name')
      if (error) throw error
      return data as Role[]
    },
  })
}

// Send invitation
export function useInviteMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: InviteMemberData) => {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send invitation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
    },
  })
}

// Update member role/assignment
export function useUpdateMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMemberData }) => {
      const response = await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update member')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

// Remove member
export function useRemoveMember() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberId: string) => {
      const response = await fetch(`/api/team/${memberId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove member')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
    },
  })
}

// Resend invitation
export function useResendInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch('/api/team/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resend invitation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
    },
  })
}

// Cancel invitation
export function useCancelInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await fetch(`/api/team/invite/${invitationId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel invitation')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] })
    },
  })
}
