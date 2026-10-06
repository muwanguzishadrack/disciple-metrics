import {
  PGA_METRIC_KEYS,
  PGA_METRICS,
  type PgaMetricKey,
  type PgaMetricValues,
} from '@/lib/validations/pga'

/** A metric from a past entry; null/undefined = not recorded (e.g. column added later). */
export type PgaHistoryEntry = Partial<Record<PgaMetricKey, number | null | undefined>>

export interface PgaOutlierFlag {
  key: PgaMetricKey
  label: string
  value: number
  /** Average across the history entries that recorded this metric. */
  average: number
}

export interface PgaOutlierResult {
  /** Metrics far above their recent average. */
  spikes: PgaOutlierFlag[]
  /** The location reported something recently and this entry is all zeros. */
  droppedToZero: boolean
  /** Convenience: true when the user should be asked to confirm. */
  hasWarnings: boolean
}

export interface PgaOutlierOptions {
  /** A value is a spike when it is more than this multiple of the average... */
  ratio?: number
  /** ...and exceeds the average by at least this much (ignores noise on tiny numbers). */
  minIncrease?: number
}

export const PGA_OUTLIER_RATIO = 5
export const PGA_OUTLIER_MIN_INCREASE = 20
export const PGA_OUTLIER_HISTORY_SIZE = 4

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Compare a new/edited entry against the location's recent history
 * (typically its last 4 entries before this report date).
 * Pure: no I/O, so it can be unit-tested and reused by create and edit.
 */
export function detectPgaOutliers(
  current: PgaMetricValues,
  history: PgaHistoryEntry[],
  options: PgaOutlierOptions = {}
): PgaOutlierResult {
  const ratio = options.ratio ?? PGA_OUTLIER_RATIO
  const minIncrease = options.minIncrease ?? PGA_OUTLIER_MIN_INCREASE

  if (history.length === 0) {
    return { spikes: [], droppedToZero: false, hasWarnings: false }
  }

  const spikes: PgaOutlierFlag[] = []
  for (const key of PGA_METRIC_KEYS) {
    const recorded = history
      .map((entry) => entry[key])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (recorded.length === 0) continue

    const average = recorded.reduce((a, b) => a + b, 0) / recorded.length
    const value = current[key] ?? 0
    if (value > ratio * average && value - average >= minIncrease) {
      spikes.push({ key, label: PGA_METRICS[key].label, value, average: round1(average) })
    }
  }

  const hadActivity = history.some((entry) =>
    PGA_METRIC_KEYS.some((key) => (entry[key] ?? 0) > 0)
  )
  const nowAllZero = PGA_METRIC_KEYS.every((key) => (current[key] ?? 0) === 0)
  const droppedToZero = hadActivity && nowAllZero

  return { spikes, droppedToZero, hasWarnings: spikes.length > 0 || droppedToZero }
}

/** "1st Service (sv1): 150 vs 4-wk avg 14" */
export function formatPgaOutlierFlag(flag: PgaOutlierFlag, weeks = PGA_OUTLIER_HISTORY_SIZE): string {
  const column = PGA_METRICS[flag.key].column
  return `${flag.label} (${column}): ${flag.value.toLocaleString('en')} vs ${weeks}-wk avg ${flag.average.toLocaleString('en')}`
}
