'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ROUTES } from '@/lib/constants'
import {
  LoginFormData,
  SignupFormData,
  ForgotPasswordFormData,
  ResetPasswordFormData,
} from '@/lib/validations/auth'

export function useLogin() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Login failed')
      }

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      router.push(ROUTES.DASHBOARD)
      router.refresh()
    },
  })
}

export function useSignup() {
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: SignupFormData) => {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Signup failed')
      }

      return result
    },
    onSuccess: () => {
      router.push(ROUTES.DASHBOARD)
      router.refresh()
    },
  })
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reset email')
      }

      return result
    },
  })
}

export function useResetPassword() {
  const supabase = createClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      })
      if (error) throw error
    },
    onSuccess: () => {
      router.push(ROUTES.LOGIN)
    },
  })
}

export function useSetPassword() {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      router.push(ROUTES.DASHBOARD)
      router.refresh()
    },
  })
}

export function useLogout() {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.clear()
      router.push(ROUTES.LOGIN)
      router.refresh()
    },
  })
}

export function useUpdateEmail() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.updateUser({ email })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
    },
  })
}

export function useUpdatePassword() {
  const supabase = createClient()

  return useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string
      newPassword: string
    }) => {
      // First verify current password by reauthenticating
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.email) throw new Error('No user email found')

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      })
      if (signInError) throw new Error('Current password is incorrect')

      // Update to new password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error
    },
  })
}

export function useDeleteAccount() {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete account')
      }
    },
    onSuccess: () => {
      queryClient.clear()
      router.push(ROUTES.HOME)
      router.refresh()
    },
  })
}

export function useResendVerificationEmail() {
  const supabase = createClient()

  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
      if (error) throw error
    },
  })
}
