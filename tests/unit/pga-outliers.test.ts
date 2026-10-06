import { describe, it, expect } from 'vitest'
import {
  detectPgaOutliers,
  formatPgaOutlierFlag,
  type PgaHistoryEntry,
} from '@/components/pga/pga-outliers'
import { PGA_METRIC_KEYS, type PgaMetricValues } from '@/lib/validations/pga'

function values(overrides: Partial<PgaMetricValues> = {}): PgaMetricValues {
  const base = Object.fromEntries(PGA_METRIC_KEYS.map((k) => [k, 0])) as PgaMetricValues
  return { ...base, ...overrides }
}

const steadyHistory: PgaHistoryEntry[] = [
  { sv1: 12, sv2: 8, kids: 5 },
  { sv1: 14, sv2: 9, kids: 4 },
  { sv1: 16, sv2: 7, kids: 6 },
  { sv1: 14, sv2: 8, kids: 5 },
]

describe('detectPgaOutliers', () => {
  it('returns no warnings without history', () => {
    const result = detectPgaOutliers(values({ sv1: 5000 }), [])
    expect(result).toEqual({ spikes: [], droppedToZero: false, hasWarnings: false })
  })

  it('accepts normal week-to-week variation', () => {
    const result = detectPgaOutliers(values({ sv1: 20, sv2: 10, kids: 7 }), steadyHistory)
    expect(result.hasWarnings).toBe(false)
  })

  it('flags a value more than 5x the 4-week average by 20+', () => {
    const result = detectPgaOutliers(values({ sv1: 150, sv2: 8 }), steadyHistory)
    expect(result.hasWarnings).toBe(true)
    expect(result.spikes).toHaveLength(1)
    expect(result.spikes[0]).toMatchObject({ key: 'sv1', value: 150, average: 14 })
  })

  it('ignores big ratios on tiny numbers (increase under 20)', () => {
    // avg kids = 5; 24 is under 5x
    expect(detectPgaOutliers(values({ sv1: 14, kids: 24 }), steadyHistory).spikes).toEqual([])
    // avg 1 -> 15 is 15x but only +14 above the average
    const tiny: PgaHistoryEntry[] = [{ mca: 1 }, { mca: 1 }, { mca: 1 }, { mca: 1 }]
    expect(detectPgaOutliers(values({ mca: 15 }), tiny).spikes).toEqual([])
  })

  it('requires both the ratio and the minimum increase', () => {
    // avg 100 -> 450 is +350 but only 4.5x
    const big: PgaHistoryEntry[] = [{ sv1: 100 }, { sv1: 100 }]
    expect(detectPgaOutliers(values({ sv1: 450 }), big).spikes).toEqual([])
    expect(detectPgaOutliers(values({ sv1: 501 }), big).spikes).toHaveLength(1)
  })

  it('is strictly greater than 5x', () => {
    const hist: PgaHistoryEntry[] = [{ sv1: 10 }]
    expect(detectPgaOutliers(values({ sv1: 50 }), hist).spikes).toEqual([])
    expect(detectPgaOutliers(values({ sv1: 51 }), hist).spikes).toHaveLength(1)
  })

  it('averages only over entries that recorded the metric', () => {
    // mechanics_get null in older rows (column added later) must not drag the average to 0
    const hist: PgaHistoryEntry[] = [
      { sv1: 10, mechanicsGet: 10 },
      { sv1: 10, mechanicsGet: null },
      { sv1: 10, mechanicsGet: undefined },
    ]
    const result = detectPgaOutliers(values({ sv1: 10, mechanicsGet: 40 }), hist)
    expect(result.spikes).toEqual([])
  })

  it('treats a zero average as eligible once the increase reaches 20', () => {
    const hist: PgaHistoryEntry[] = [{ sv1: 10, baptisms: 0 }, { sv1: 10, baptisms: 0 }]
    expect(detectPgaOutliers(values({ sv1: 10, baptisms: 19 }), hist).spikes).toEqual([])
    expect(detectPgaOutliers(values({ sv1: 10, baptisms: 20 }), hist).spikes).toHaveLength(1)
  })

  it('flags a drop to all zeros after recent activity', () => {
    const result = detectPgaOutliers(values(), steadyHistory)
    expect(result.droppedToZero).toBe(true)
    expect(result.hasWarnings).toBe(true)
    expect(result.spikes).toEqual([])
  })

  it('does not flag all zeros when the location had no activity either', () => {
    const quiet: PgaHistoryEntry[] = [{ sv1: 0 }, { sv1: 0, kids: null }]
    expect(detectPgaOutliers(values(), quiet).hasWarnings).toBe(false)
  })

  it('does not flag zero-drop when any metric is non-zero', () => {
    expect(detectPgaOutliers(values({ kids: 1 }), steadyHistory).droppedToZero).toBe(false)
  })

  it('reports several spikes at once', () => {
    const result = detectPgaOutliers(values({ sv1: 200, sv2: 100 }), steadyHistory)
    expect(result.spikes.map((s) => s.key)).toEqual(['sv1', 'sv2'])
  })

  it('accepts custom thresholds', () => {
    const result = detectPgaOutliers(values({ sv1: 30 }), steadyHistory, {
      ratio: 2,
      minIncrease: 5,
    })
    expect(result.spikes).toHaveLength(1)
  })
})

describe('formatPgaOutlierFlag', () => {
  it('formats label, column, value and average', () => {
    expect(
      formatPgaOutlierFlag({ key: 'sv1', label: '1st Service', value: 150, average: 14 })
    ).toBe('1st Service (sv1): 150 vs 4-wk avg 14')
  })

  it('uses the number of weeks compared', () => {
    expect(
      formatPgaOutlierFlag(
        { key: 'salvationsMc', label: 'Salvs in MCs', value: 1200, average: 12.5 },
        2
      )
    ).toBe('Salvs in MCs (salvations_mc): 1,200 vs 2-wk avg 12.5')
  })
})
