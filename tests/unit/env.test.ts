import { describe, it, expect, vi, afterEach } from 'vitest'

describe('lib/env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('accepts a valid configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service')
    const { env } = await import('@/lib/env')
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321')
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('anon')
    expect(env.NODE_ENV).toBe('test')
  })

  it('allows the service role key to be absent (browser)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', undefined)
    const { env } = await import('@/lib/env')
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
  })

  it('throws and logs field errors for an invalid URL or missing key', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not a url')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '')
    await expect(import('@/lib/env')).rejects.toThrow('Invalid environment variables')
    expect(log).toHaveBeenCalledWith({
      NEXT_PUBLIC_SUPABASE_URL: ['NEXT_PUBLIC_SUPABASE_URL must be a valid URL'],
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ['NEXT_PUBLIC_SUPABASE_ANON_KEY is required'],
    })
  })
})
