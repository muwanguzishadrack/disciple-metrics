// Edit-lock date maths. Mirrors the DB function is_pga_report_locked():
//   p_report_date < (now() at time zone 'Africa/Nairobi')::date - N
// The DB trigger is the real enforcement; this only decides what the UI shows.

export const PGA_LOCK_TIME_ZONE = 'Africa/Nairobi'

/** Today's calendar date in Nairobi as YYYY-MM-DD. */
export function nairobiToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PGA_LOCK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Subtract whole days from a YYYY-MM-DD date (calendar arithmetic, no TZ drift). */
export function subtractDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

/**
 * True when a report dated `reportDate` (YYYY-MM-DD) is past the edit window.
 * `lockDays` null/undefined/invalid means "no lock configured" -> never locked,
 * so the UI degrades to today's behaviour if the setting/RPC isn't deployed.
 */
export function isPgaReportDateLocked(
  reportDate: string | null | undefined,
  lockDays: number | null | undefined,
  now: Date = new Date()
): boolean {
  if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return false
  if (typeof lockDays !== 'number' || !Number.isFinite(lockDays) || lockDays < 0) return false
  const cutoff = subtractDays(nairobiToday(now), lockDays)
  return reportDate < cutoff
}

export function pgaLockMessage(lockDays: number): string {
  return `Reports lock ${lockDays} day${lockDays === 1 ? '' : 's'} after the report date. Contact an admin for corrections.`
}
