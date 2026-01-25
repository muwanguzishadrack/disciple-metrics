'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const hasProcessedRef = useRef(false)

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent duplicate calls in React Strict Mode
      if (hasProcessedRef.current) return
      hasProcessedRef.current = true

      const supabase = createClient()

      // Note: token_hash recovery flow is now handled server-side at /auth/confirm

      // Get the hash fragment from the URL
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      // Check if this is an invite flow with hash tokens
      if (accessToken && refreshToken && type === 'invite') {
        try {
          // Set the session using the tokens from the hash
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            console.error('Session error:', sessionError)
            setError('Failed to authenticate. Please try the invitation link again.')
            return
          }

          if (data.user) {
            // Get invitation token from user metadata
            const invitationToken = data.user.user_metadata?.invitation_token

            if (invitationToken) {
              // Process the invitation server-side
              // Pass the access token directly to avoid cookie timing issues
              try {
                const response = await fetch('/api/auth/accept-invitation', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({ invitationToken }),
                })

                if (!response.ok) {
                  const errorData = await response.json()
                  console.error('Failed to process invitation:', errorData)
                }
              } catch (err) {
                console.error('Error processing invitation:', err)
              }
            }

            // Redirect to set password page for invited users
            router.replace('/auth/set-password')
            return
          }
        } catch (err) {
          console.error('Error handling invite callback:', err)
          setError('An error occurred. Please try the invitation link again.')
          return
        }
      }

      // Handle recovery flow (password reset) with hash tokens
      if (accessToken && refreshToken && type === 'recovery') {
        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            console.error('Recovery session error:', sessionError)
            setError('Failed to authenticate. The reset link may have expired.')
            return
          }

          if (data.session) {
            router.replace('/reset-password')
            return
          }
        } catch (err) {
          console.error('Error handling recovery callback:', err)
          setError('An error occurred. Please request a new password reset link.')
          return
        }
      }

      // Handle code-based auth (PKCE flow) - redirect to server callback
      const code = searchParams.get('code')
      if (code) {
        const params = new URLSearchParams(searchParams.toString())
        router.replace(`/api/auth/callback?${params.toString()}`)
        return
      }

      // No valid auth parameters
      setError('Invalid authentication request.')
    }

    handleCallback()
  }, [router, searchParams])

  if (error) {
    const isRecoveryError = error.includes('reset link') || error.includes('password reset')
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <p className="text-destructive mb-4">{error}</p>
        <a
          href={isRecoveryError ? '/forgot-password' : '/login'}
          className="text-primary hover:underline"
        >
          {isRecoveryError ? 'Request new reset link' : 'Return to login'}
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
      <p className="text-muted-foreground">Processing...</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  )
}
