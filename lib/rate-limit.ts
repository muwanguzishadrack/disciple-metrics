type RateLimitRecord = {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  const keysToDelete: string[] = []

  rateLimitStore.forEach((record, key) => {
    if (now > record.resetTime) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach((key) => rateLimitStore.delete(key))
}, 60000) // Clean up every minute

export interface RateLimitConfig {
  maxAttempts: number
  windowMs: number
}

export const RATE_LIMIT_CONFIGS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  signup: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  forgotPassword: { maxAttempts: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  resetPassword: { maxAttempts: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
} as const

export type RateLimitAction = keyof typeof RATE_LIMIT_CONFIGS

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetIn: number // seconds until reset
}

export function checkRateLimit(
  identifier: string,
  action: RateLimitAction
): RateLimitResult {
  const config = RATE_LIMIT_CONFIGS[action]
  const key = `${action}:${identifier}`
  const now = Date.now()

  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    // First attempt or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return {
      success: true,
      remaining: config.maxAttempts - 1,
      resetIn: Math.ceil(config.windowMs / 1000),
    }
  }

  if (record.count >= config.maxAttempts) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetIn: Math.ceil((record.resetTime - now) / 1000),
    }
  }

  // Increment count
  record.count++
  rateLimitStore.set(key, record)

  return {
    success: true,
    remaining: config.maxAttempts - record.count,
    resetIn: Math.ceil((record.resetTime - now) / 1000),
  }
}

export function getClientIp(request: Request): string {
  // Check various headers for the real IP (behind proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback - in production, this might not be accurate
  return 'unknown'
}
