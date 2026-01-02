'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ROUTES } from '@/lib/constants'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const WARNING_BEFORE_TIMEOUT = 2 * 60 * 1000 // Show warning 2 minutes before timeout

interface SessionTimeoutProviderProps {
  children: React.ReactNode
}

export function SessionTimeoutProvider({ children }: SessionTimeoutProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(120) // 2 minutes in seconds

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const warningRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  // Define auth routes that don't need session timeout
  const authRoutes = ['/login', '/signup', '/forgot-password', '/verify-email', '/reset-password']
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (warningRef.current) clearTimeout(warningRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }, [])

  const handleLogout = useCallback(async () => {
    clearAllTimers()
    setShowWarning(false)

    const supabase = createClient()
    await supabase.auth.signOut()

    toast({
      title: 'Session expired',
      description: 'You have been logged out due to inactivity.',
    })

    router.push(ROUTES.LOGIN)
    router.refresh()
  }, [clearAllTimers, router, toast])

  const resetTimers = useCallback(() => {
    clearAllTimers()
    setShowWarning(false)
    setCountdown(120)
    lastActivityRef.current = Date.now()

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true)
      setCountdown(120)

      // Start countdown
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }, IDLE_TIMEOUT - WARNING_BEFORE_TIMEOUT)

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      handleLogout()
    }, IDLE_TIMEOUT)
  }, [clearAllTimers, handleLogout])

  const handleStayLoggedIn = useCallback(() => {
    resetTimers()
  }, [resetTimers])

  // Set up activity listeners
  useEffect(() => {
    if (isAuthRoute) {
      clearAllTimers()
      return
    }

    const handleActivity = () => {
      // Only reset if warning is not showing
      if (!showWarning) {
        const now = Date.now()
        // Debounce: only reset if more than 1 second has passed
        if (now - lastActivityRef.current > 1000) {
          resetTimers()
        }
      }
    }

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Initialize timers
    resetTimers()

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      clearAllTimers()
    }
  }, [isAuthRoute, showWarning, resetTimers, clearAllTimers])

  // Don't render warning dialog on auth routes
  if (isAuthRoute) {
    return <>{children}</>
  }

  return (
    <>
      {children}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Session Expiring Soon</AlertDialogTitle>
            <AlertDialogDescription>
              Your session will expire in {countdown} seconds due to inactivity.
              Would you like to stay logged in?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleStayLoggedIn}>
              Stay Logged In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
