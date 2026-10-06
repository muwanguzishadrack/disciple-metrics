import { describe, it, expect } from 'vitest'
import {
  addMonthsClamped,
  comparisonRange,
  daysInclusive,
  delta,
  isValidRange,
  parseISODate,
  presetBlockMonths,
  previousPeriod,
  resolveComparePreset,
  resolveTrendPreset,
  rollingAverage,
  samePeriodLastYear,
  toISODate,
  ytdRange,
} from '@/components/analytics/periods'

const d = (s: string) => parseISODate(s)

describe('date helpers', () => {
  it('round-trips ISO dates without time zone drift', () => {
    expect(toISODate(d('2026-03-29'))).toBe('2026-03-29')
    expect(toISODate(d('2024-02-29'))).toBe('2024-02-29')
  })

  it('counts inclusive days', () => {
    expect(daysInclusive({ start: '2026-10-04', end: '2026-10-04' })).toBe(1)
    expect(daysInclusive({ start: '2026-01-01', end: '2026-12-31' })).toBe(365)
    // Across a DST change (EU, last Sunday of March) still whole days
    expect(daysInclusive({ start: '2026-03-28', end: '2026-03-30' })).toBe(3)
  })

  it('clamps month arithmetic to month length', () => {
    expect(toISODate(addMonthsClamped(d('2026-03-31'), -1))).toBe('2026-02-28')
    expect(toISODate(addMonthsClamped(d('2024-03-31'), -1))).toBe('2024-02-29')
    expect(toISODate(addMonthsClamped(d('2026-01-15'), -1))).toBe('2025-12-15')
  })

  it('validates ranges', () => {
    expect(isValidRange({ start: '2026-01-01', end: '2026-01-31' })).toBe(true)
    expect(isValidRange({ start: '2026-02-01', end: '2026-01-31' })).toBe(false)
    expect(isValidRange({ start: '', end: '2026-01-31' })).toBe(false)
    expect(isValidRange(null)).toBe(false)
  })
})

describe('YTD', () => {
  it('runs from 1 Jan to today', () => {
    expect(ytdRange(d('2026-10-04'))).toEqual({ start: '2026-01-01', end: '2026-10-04' })
  })
})

describe('resolveTrendPreset', () => {
  const today = d('2026-10-04')

  it('last 12 weeks covers 84 days ending today', () => {
    const r = resolveTrendPreset('last-12-weeks', today)!
    expect(r.end).toBe('2026-10-04')
    expect(daysInclusive(r)).toBe(84)
  })

  it('last 6 / 12 months', () => {
    expect(resolveTrendPreset('last-6-months', today)).toEqual({
      start: '2026-04-05',
      end: '2026-10-04',
    })
    expect(resolveTrendPreset('last-12-months', today)).toEqual({
      start: '2025-10-05',
      end: '2026-10-04',
    })
  })

  it('custom needs both bounds in order', () => {
    expect(resolveTrendPreset('custom', today, { start: '2026-01-04' })).toBeNull()
    expect(
      resolveTrendPreset('custom', today, { start: '2026-01-04', end: '2026-02-01' })
    ).toEqual({ start: '2026-01-04', end: '2026-02-01' })
  })
})

describe('resolveComparePreset', () => {
  const today = d('2026-10-04')

  it('resolves calendar presets', () => {
    expect(resolveComparePreset('ytd', today)).toEqual({ start: '2026-01-01', end: '2026-10-04' })
    expect(resolveComparePreset('this-month', today)).toEqual({ start: '2026-10-01', end: '2026-10-04' })
    expect(resolveComparePreset('last-month', today)).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(resolveComparePreset('this-quarter', today)).toEqual({ start: '2026-10-01', end: '2026-10-04' })
    expect(resolveComparePreset('this-quarter', d('2026-08-16'))).toEqual({ start: '2026-07-01', end: '2026-08-16' })
  })

  it('last month in January is December of the previous year', () => {
    expect(resolveComparePreset('last-month', d('2026-01-10'))).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    })
  })
})

describe('previousPeriod', () => {
  it('shifts an arbitrary range back by its own length', () => {
    expect(previousPeriod({ start: '2026-09-06', end: '2026-09-27' })).toEqual({
      start: '2026-08-15',
      end: '2026-09-05',
    })
  })

  it('YTD compares with the same number of days immediately before', () => {
    const range = { start: '2026-01-01', end: '2026-10-04' }
    const prev = previousPeriod(range)
    expect(prev.end).toBe('2025-12-31')
    expect(daysInclusive(prev)).toBe(daysInclusive(range))
  })

  it('a whole calendar month compares with the previous whole month', () => {
    expect(previousPeriod({ start: '2026-03-01', end: '2026-03-31' })).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })

  it('a whole quarter compares with the previous quarter', () => {
    expect(previousPeriod({ start: '2026-01-01', end: '2026-03-31' })).toEqual({
      start: '2025-10-01',
      end: '2025-12-31',
    })
  })

  it('month-to-date compares with the same days last month', () => {
    expect(previousPeriod({ start: '2026-10-01', end: '2026-10-04' }, 1)).toEqual({
      start: '2026-09-01',
      end: '2026-09-04',
    })
    // End clamps to the shorter month
    expect(previousPeriod({ start: '2026-03-01', end: '2026-03-30' }, 1)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })

  it('quarter-to-date compares with the same span last quarter', () => {
    expect(previousPeriod({ start: '2026-10-01', end: '2026-11-15' }, 3)).toEqual({
      start: '2026-07-01',
      end: '2026-08-15',
    })
  })

  it('presetBlockMonths maps to-date presets', () => {
    expect(presetBlockMonths('this-month')).toBe(1)
    expect(presetBlockMonths('this-quarter')).toBe(3)
    expect(presetBlockMonths('ytd')).toBeUndefined()
    expect(presetBlockMonths('last-month')).toBeUndefined()
  })
})

describe('samePeriodLastYear', () => {
  it('shifts both bounds back a year', () => {
    expect(samePeriodLastYear({ start: '2026-01-01', end: '2026-10-04' })).toEqual({
      start: '2025-01-01',
      end: '2025-10-04',
    })
  })

  it('clamps 29 Feb', () => {
    expect(samePeriodLastYear({ start: '2024-02-01', end: '2024-02-29' })).toEqual({
      start: '2023-02-01',
      end: '2023-02-28',
    })
  })
})

describe('comparisonRange', () => {
  const range = { start: '2026-01-01', end: '2026-10-04' }
  it('dispatches on mode', () => {
    expect(comparisonRange(range, 'none')).toBeNull()
    expect(comparisonRange(range, 'last-year')).toEqual(samePeriodLastYear(range))
    expect(comparisonRange(range, 'previous')).toEqual(previousPeriod(range))
    expect(comparisonRange({ start: '2026-10-01', end: '2026-10-04' }, 'previous', 1)).toEqual({
      start: '2026-09-01',
      end: '2026-09-04',
    })
  })
})

describe('rollingAverage', () => {
  it('is null until the window is full, then a trailing mean', () => {
    expect(rollingAverage([4, 8, 12, 16, 20])).toEqual([null, null, null, 10, 14])
  })

  it('supports other window sizes', () => {
    expect(rollingAverage([1, 2, 3], 2)).toEqual([null, 1.5, 2.5])
    expect(rollingAverage([5], 1)).toEqual([5])
  })

  it('skips missing values inside a window', () => {
    expect(rollingAverage([4, null, 8, 12])).toEqual([null, null, null, 8])
    expect(rollingAverage([null, null, null, null])).toEqual([null, null, null, null])
  })

  it('handles empty input', () => {
    expect(rollingAverage([])).toEqual([])
  })
})

describe('delta', () => {
  it('computes absolute and percentage change', () => {
    expect(delta(150, 100)).toEqual({ abs: 50, pct: 0.5 })
    expect(delta(75, 100)).toEqual({ abs: -25, pct: -0.25 })
  })

  it('has no percentage when the comparison is zero', () => {
    expect(delta(10, 0)).toEqual({ abs: 10, pct: null })
  })

  it('has nothing when there is no comparison', () => {
    expect(delta(10, null)).toEqual({ abs: null, pct: null })
    expect(delta(10, undefined)).toEqual({ abs: null, pct: null })
  })

  it('treats a missing current value as zero', () => {
    expect(delta(null, 40)).toEqual({ abs: -40, pct: -1 })
  })
})
