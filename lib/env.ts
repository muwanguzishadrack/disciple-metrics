// This module is imported by the browser Supabase client, so it ships with
// every page. It validates four variables, which does not justify bundling a
// schema library (zod 4 would add ~10-30 KB gzip to every route), so the
// checks are written out by hand with the same rules and messages.

const NODE_ENVS = ['development', 'production', 'test'] as const

export interface Env {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY?: string

  // Node environment
  NODE_ENV: (typeof NODE_ENVS)[number]
}

function isUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function validateEnv(): Env {
  const input = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NODE_ENV: process.env.NODE_ENV,
  }

  const fieldErrors: Partial<Record<keyof Env, string[]>> = {}
  const fail = (key: keyof Env, message: string) => (fieldErrors[key] ??= []).push(message)

  if (input.NEXT_PUBLIC_SUPABASE_URL === undefined) fail('NEXT_PUBLIC_SUPABASE_URL', 'Required')
  else if (!isUrl(input.NEXT_PUBLIC_SUPABASE_URL))
    fail('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL must be a valid URL')

  if (input.NEXT_PUBLIC_SUPABASE_ANON_KEY === undefined) fail('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Required')
  else if (input.NEXT_PUBLIC_SUPABASE_ANON_KEY.length < 1)
    fail('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required')

  if (input.SUPABASE_SERVICE_ROLE_KEY !== undefined && input.SUPABASE_SERVICE_ROLE_KEY.length < 1)
    fail('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY is required')

  const nodeEnv = input.NODE_ENV ?? 'development'
  if (!(NODE_ENVS as readonly string[]).includes(nodeEnv))
    fail('NODE_ENV', `Invalid enum value. Expected ${NODE_ENVS.map((v) => `'${v}'`).join(' | ')}, received '${nodeEnv}'`)

  if (Object.keys(fieldErrors).length > 0) {
    console.error('❌ Invalid environment variables:')
    console.error(fieldErrors)

    throw new Error('Invalid environment variables. Check the console for details.')
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: input.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: input.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ...(input.SUPABASE_SERVICE_ROLE_KEY !== undefined && {
      SUPABASE_SERVICE_ROLE_KEY: input.SUPABASE_SERVICE_ROLE_KEY,
    }),
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
  }
}

// Validate on import (runs at startup)
export const env = validateEnv()

// Helper to check if we're in production
export const isProduction = env.NODE_ENV === 'production'

// Helper to check if we're in development
export const isDevelopment = env.NODE_ENV === 'development'
