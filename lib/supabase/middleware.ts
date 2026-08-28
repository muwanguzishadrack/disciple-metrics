import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/supabase'

// getUser() is a network call to GoTrue and supabase-js applies no timeout of
// its own. When that call stalls, middleware never returns, Vercel kills it at
// 25s and the request 504s -- which is what took out /dashboard, /login and /
// in production. Bound it so middleware always answers.
//
// 3s is ~4x the worst case measured against this project's auth logs: /user
// runs p50 5ms / p95 163ms / max 291ms, and the /token refresh it can trigger
// runs p50 231ms / p95 477ms / max 738ms.
const AUTH_TIMEOUT_MS = 3000

// A refresh token that is missing or already rotated can never succeed on a
// retry -- the session is dead and the browser will otherwise replay it on
// every request. Detected so it can be cleared rather than silently ignored.
function isRefreshTokenError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  const { code, message } = error as { code?: unknown; message?: unknown }
  return (
    code === 'refresh_token_not_found' ||
    (typeof message === 'string' &&
      message.toLowerCase().includes('refresh token'))
  )
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-') && name.includes('-auth-token')) {
      response.cookies.delete(name)
    }
  })
  return response
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`supabase.auth.getUser() timed out after ${ms}ms`)),
      ms
    )
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

type CookieToSet = {
  name: string
  value: string
  options?: CookieOptions
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in middleware')
    return supabaseResponse
  }

  const pathname = request.nextUrl.pathname

  // Define protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/settings']
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Define auth routes (should redirect to dashboard if already authenticated)
  // Note: /reset-password is excluded because users need to be authenticated
  // (via the magic link) to reset their password
  const authRoutes = ['/login', '/signup', '/forgot-password']
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  // The redirects below are the only thing the session is used for, so on every
  // other path the getUser() round-trip was work whose result got discarded --
  // /reports, /locations, /team, /verify-email and every RSC prefetch among
  // them. Skipping it removes most calls to GoTrue, and with them most of the
  // exposure to a stalled one. Safe because the browser client runs with
  // autoRefreshToken, so it keeps its own session alive without middleware.
  if (!isProtectedRoute && !isAuthRoute) {
    return supabaseResponse
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  let user: User | null = null
  try {
    const result = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS)
    user = result.data.user
  } catch (error) {
    // A dead refresh token never recovers, so clear it and treat the request as
    // signed out. Otherwise the browser replays the same broken token forever
    // and the user sits in a half-logged-in state.
    if (isRefreshTokenError(error)) {
      if (isProtectedRoute) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return clearAuthCookies(request, NextResponse.redirect(url))
      }
      return clearAuthCookies(request, NextResponse.next({ request }))
    }

    // Anything else (notably a timeout) is transient, so fail open rather than
    // 504 or crash: skip the redirect decisions and let the request through.
    // Pages are client-rendered and every table is RLS-protected, so an
    // unauthenticated visitor still sees nothing -- and a signed-in one is not
    // bounced to /login over a blip.
    console.error(
      'Middleware auth check failed, passing request through:',
      error
    )
    return supabaseResponse
  }

  // Redirect unauthenticated users away from protected routes
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth routes
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
