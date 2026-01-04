export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_RATE_LIMITED'
  | 'LOGOUT'
  | 'SIGNUP_SUCCESS'
  | 'SIGNUP_FAILED'
  | 'SIGNUP_RATE_LIMITED'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'PASSWORD_RESET_RATE_LIMITED'
  | 'PASSWORD_CHANGE_SUCCESS'
  | 'PASSWORD_CHANGE_FAILED'
  | 'EMAIL_CHANGE_REQUEST'
  | 'EMAIL_VERIFIED'
  | 'ACCOUNT_DELETED'
  | 'SESSION_EXPIRED'
  | 'TEAM_INVITE_SENT'
  | 'TEAM_INVITE_RESENT'
  | 'TEAM_INVITE_CANCELLED'
  | 'TEAM_INVITE_ACCEPTED'
  | 'TEAM_MEMBER_UPDATED'
  | 'TEAM_MEMBER_REMOVED'

export interface AuditLogEntry {
  action: AuditAction
  userId?: string
  ip?: string
  userAgent?: string
  details?: Record<string, unknown>
}

export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    // Log to console in a structured format
    // In production, this can be picked up by log aggregation services
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'AUDIT',
      action: entry.action,
      userId: entry.userId || null,
      ip: entry.ip || null,
      userAgent: entry.userAgent || null,
      details: entry.details || {},
    }

    // Use structured logging
    console.log(JSON.stringify(logEntry))

    // Optionally insert to database if service role key is available
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const supabase = createAdminClient()

      // Use raw SQL to insert into audit_logs
      await supabase.from('audit_logs' as never).insert({
        action: entry.action,
        user_id: entry.userId || null,
        ip_address: entry.ip || null,
        user_agent: entry.userAgent || null,
        details: entry.details || {},
        created_at: new Date().toISOString(),
      } as never)
    }
  } catch (error) {
    // Never let audit logging failures affect the main operation
    console.error('Audit logging error:', error)
  }
}

// Helper to get user agent from request
export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown'
}
