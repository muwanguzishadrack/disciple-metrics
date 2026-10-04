// Pure date-period math for the reporting pages. Everything works on
// 'yyyy-MM-dd' strings (the shape pga_reports.date uses) and on local calendar
// dates, so no time zone ever shifts a day. Kept free of React and Supabase so
// it can be unit tested directly.

export interface DateRange {
  /** Inclusive start, yyyy-MM-dd */
  start: string
  /** Inclusive end, yyyy-MM-dd */
  end: string
}

export type TrendPreset =
  | 'last-12-weeks'
  | 'last-6-months'
  | 'ytd'
  | 'last-12-months'
  | 'custom'

export type ComparePreset =
  | 'ytd'
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'custom'

export type ComparisonMode = 'previous' | 'last-year' | 'none'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Midnight today in local time */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Shift a date by whole months, clamping the day to the target month's length
 * (31 Mar - 1 month = 28/29 Feb, not 3 Mar).
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const day = Math.min(
    date.getDate(),
    lastDayOfMonth(target.getFullYear(), target.getMonth())
  )
  return new Date(target.getFullYear(), target.getMonth(), day)
}

/** Number of days in an inclusive range (a single day is 1) */
export function daysInclusive(range: DateRange): number {
  const start = parseISODate(range.start)
  const end = parseISODate(range.end)
  // Round to absorb DST hour shifts
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

export function isValidRange(range: DateRange | null | undefined): range is DateRange {
  if (!range?.start || !range?.end) return false
  return /^\d{4}-\d{2}-\d{2}$/.test(range.start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(range.end) &&
    range.start <= range.end
}

export function ytdRange(today: Date): DateRange {
  return {
    start: `${today.getFullYear()}-01-01`,
    end: toISODate(today),
  }
}

/** Range for a Trends preset. Returns null for 'custom' without both bounds. */
export function resolveTrendPreset(
  preset: TrendPreset,
  today: Date,
  custom?: Partial<DateRange>
): DateRange | null {
  const end = toISODate(today)
  switch (preset) {
    case 'last-12-weeks':
      // 12 weekly reports: today and the 83 days before it
      return { start: toISODate(addDays(today, -83)), end }
    case 'last-6-months':
      return { start: toISODate(addDays(addMonthsClamped(today, -6), 1)), end }
    case 'last-12-months':
      return { start: toISODate(addDays(addMonthsClamped(today, -12), 1)), end }
    case 'ytd':
      return ytdRange(today)
    case 'custom': {
      const range = { start: custom?.start ?? '', end: custom?.end ?? '' }
      return isValidRange(range) ? range : null
    }
  }
}

/** Range for a Compare preset. Returns null for 'custom' without both bounds. */
export function resolveComparePreset(
  preset: ComparePreset,
  today: Date,
  custom?: Partial<DateRange>
): DateRange | null {
  const y = today.getFullYear()
  const m = today.getMonth()
  switch (preset) {
    case 'ytd':
      return ytdRange(today)
    case 'this-month':
      return { start: toISODate(new Date(y, m, 1)), end: toISODate(today) }
    case 'last-month':
      return {
        start: toISODate(new Date(y, m - 1, 1)),
        end: toISODate(new Date(y, m, 0)),
      }
    case 'this-quarter': {
      const qStartMonth = Math.floor(m / 3) * 3
      return { start: toISODate(new Date(y, qStartMonth, 1)), end: toISODate(today) }
    }
    case 'custom': {
      const range = { start: custom?.start ?? '', end: custom?.end ?? '' }
      return isValidRange(range) ? range : null
    }
  }
}

/**
 * The period immediately before `range`, of the same length.
 *
 * Calendar-aware so comparisons read the way people expect:
 * - `blockMonths` (to-date presets): month-to-date passes 1, quarter-to-date 3;
 *   both bounds move back that many months, clamped to month length
 *   (1-4 Oct MTD -> 1-4 Sep; 1 Oct-4 Oct QTD -> 1-4 Jul);
 * - a run of whole calendar months (last month, a full quarter) compares with
 *   the same number of whole months before it (Sep -> Aug);
 * - anything else shifts back by exactly its own number of days.
 */
export function previousPeriod(range: DateRange, blockMonths?: number): DateRange {
  const start = parseISODate(range.start)
  const end = parseISODate(range.end)

  if (blockMonths && blockMonths > 0) {
    return {
      start: toISODate(addMonthsClamped(start, -blockMonths)),
      end: toISODate(addMonthsClamped(end, -blockMonths)),
    }
  }

  const startsOnFirst = start.getDate() === 1
  const endsOnLastDay =
    end.getDate() === lastDayOfMonth(end.getFullYear(), end.getMonth())
  const monthSpan =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1

  if (startsOnFirst && endsOnLastDay) {
    const prevStart = new Date(start.getFullYear(), start.getMonth() - monthSpan, 1)
    const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0)
    return { start: toISODate(prevStart), end: toISODate(prevEnd) }
  }

  const length = daysInclusive(range)
  return {
    start: toISODate(addDays(start, -length)),
    end: toISODate(addDays(start, -1)),
  }
}

/** The same calendar span one year earlier (29 Feb clamps to 28 Feb). */
export function samePeriodLastYear(range: DateRange): DateRange {
  return {
    start: toISODate(addMonthsClamped(parseISODate(range.start), -12)),
    end: toISODate(addMonthsClamped(parseISODate(range.end), -12)),
  }
}

/** Months per to-date block for a Compare preset (see previousPeriod) */
export function presetBlockMonths(preset: ComparePreset): number | undefined {
  if (preset === 'this-month') return 1
  if (preset === 'this-quarter') return 3
  return undefined
}

export function comparisonRange(
  range: DateRange,
  mode: ComparisonMode,
  blockMonths?: number
): DateRange | null {
  if (mode === 'previous') return previousPeriod(range, blockMonths)
  if (mode === 'last-year') return samePeriodLastYear(range)
  return null
}

/**
 * Trailing rolling average. Index i averages values[i-window+1..i]; positions
 * before a full window are null. Null/undefined values inside a window are
 * skipped (averaged over what's present); a window with no values is null.
 */
export function rollingAverage(
  values: (number | null | undefined)[],
  window = 4
): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null
    let sum = 0
    let count = 0
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j]
      if (typeof v === 'number' && Number.isFinite(v)) {
        sum += v
        count++
      }
    }
    return count === 0 ? null : sum / count
  })
}

export interface Delta {
  /** current - previous; null when there's no comparison value */
  abs: number | null
  /** Fractional change (0.25 = +25%); null when previous is 0 or missing */
  pct: number | null
}

export function delta(
  current: number | null | undefined,
  previous: number | null | undefined
): Delta {
  if (previous === null || previous === undefined || !Number.isFinite(previous)) {
    return { abs: null, pct: null }
  }
  const cur = typeof current === 'number' && Number.isFinite(current) ? current : 0
  const abs = cur - previous
  const pct = previous === 0 ? null : abs / Math.abs(previous)
  return { abs, pct }
}

export function formatRange(range: DateRange): string {
  const fmt = (s: string) =>
    parseISODate(s).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  return `${fmt(range.start)} – ${fmt(range.end)}`
}
