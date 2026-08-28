import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from '@/types/supabase'

// getUser() is a network call to GoTrue and supabase-js applies no timeout of
// its own. When that call stalls, middleware never returns, Vercel kills it at
// 25s and the request 504s -- which is what took out /dashboard, /login and /
// in production. Bound it so middleware always answers.
const AUTH_TIMEOUT_MS = 5000

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

  // Fail open rather than 504 or crash: a stalled or rejected auth check (an
  // expired refresh token rejects here) leaves `user` unknown, so skip the
  // redirect decisions and let the request through. Pages are client-rendered
  // and every table is RLS-protected, so an unauthenticated visitor still sees
  // nothing -- and a signed-in one is not bounced to /login over a blip.
  let user: User | null = null
  try {
    const result = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS)
    user = result.data.user
  } catch (error) {
    console.error(
      'Middleware auth check failed, passing request through:',
      error
    )
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
