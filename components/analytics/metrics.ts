// Metric catalogue shared by Trends, Compare and the Activity diff. Keys are the
// pga_entries / analytics-RPC column names; `derived` metrics are computed
// client-side from other columns so the UI never depends on the DB returning
// them.

export type MetricKey =
  | 'sv1'
  | 'sv2'
  | 'yxp'
  | 'kids'
  | 'local'
  | 'hc1'
  | 'hc2'
  | 'mca'
  | 'baptisms'
  | 'salvations'
  | 'salvations_inhouse'
  | 'salvations_livestream_enc'
  | 'salvations_livestream_yxp'
  | 'salvations_mc'
  | 'salvations_other'
  | 'mechanics'
  | 'mechanics_get'
  | 'mechanics_worship'
  | 'mechanics_training'

export type DerivedMetricKey = 'pga_total' | 'epga_total'

export type AnyMetricKey = MetricKey | DerivedMetricKey

export interface MetricDef {
  key: AnyMetricKey
  /** Short label matching the existing report tables */
  label: string
  /** Long, human-readable label */
  name: string
}

export const METRICS: Record<AnyMetricKey, MetricDef> = {
  pga_total: { key: 'pga_total', label: 'Total', name: 'PGA total' },
  epga_total: { key: 'epga_total', label: 'EPGA', name: 'EPGA total (1SV + 2SV + YXP)' },
  sv1: { key: 'sv1', label: '1SV', name: '1st service' },
  sv2: { key: 'sv2', label: '2SV', name: '2nd service' },
  yxp: { key: 'yxp', label: 'YXP', name: 'YXP' },
  kids: { key: 'kids', label: 'Kids', name: 'Kids' },
  local: { key: 'local', label: 'Local', name: 'Local' },
  hc1: { key: 'hc1', label: 'HC1', name: 'HC1' },
  hc2: { key: 'hc2', label: 'HC2', name: 'HC2' },
  mca: { key: 'mca', label: 'MCA', name: 'MCA' },
  baptisms: { key: 'baptisms', label: 'Bapt', name: 'Baptisms' },
  salvations: { key: 'salvations', label: 'Salv', name: 'Salvations (total)' },
  salvations_livestream_enc: { key: 'salvations_livestream_enc', label: 'Salv-Enc', name: 'Salvations – Livestream ENC' },
  salvations_livestream_yxp: { key: 'salvations_livestream_yxp', label: 'Salv-YXP', name: 'Salvations – Livestream YXP' },
  salvations_inhouse: { key: 'salvations_inhouse', label: 'Salv-IH', name: 'Salvations – In-house' },
  salvations_mc: { key: 'salvations_mc', label: 'Salv-MC', name: 'Salvations – MC' },
  salvations_other: { key: 'salvations_other', label: 'Salv-Oth', name: 'Salvations – Other' },
  mechanics: { key: 'mechanics', label: 'Mech', name: 'Mechanics (overall)' },
  mechanics_get: { key: 'mechanics_get', label: 'Mech-GET', name: 'Mechanics – GET' },
  mechanics_worship: { key: 'mechanics_worship', label: 'Mech-WT', name: 'Mechanics – WT' },
  mechanics_training: { key: 'mechanics_training', label: 'Mech-Trn', name: 'Mechanics – Others' },
}

export interface MetricGroup {
  id: string
  label: string
  metrics: AnyMetricKey[]
}

export const METRIC_GROUPS: MetricGroup[] = [
  {
    id: 'attendance',
    label: 'Attendance',
    metrics: ['pga_total', 'epga_total', 'sv1', 'sv2', 'yxp', 'kids', 'local'],
  },
  {
    id: 'salvations',
    label: 'Salvations',
    metrics: [
      'salvations',
      'salvations_livestream_enc',
      'salvations_livestream_yxp',
      'salvations_inhouse',
      'salvations_mc',
      'salvations_other',
    ],
  },
  { id: 'baptisms', label: 'Baptisms', metrics: ['baptisms'] },
  { id: 'hc', label: 'HC & MCA', metrics: ['hc1', 'hc2', 'mca'] },
  {
    id: 'mechanics',
    label: 'Mechanics',
    metrics: ['mechanics', 'mechanics_get', 'mechanics_worship', 'mechanics_training'],
  },
]

/** Column sets for the Compare table (one group shown at a time) */
export const COMPARE_GROUPS: MetricGroup[] = [
  {
    id: 'summary',
    label: 'Summary',
    metrics: ['pga_total', 'salvations', 'baptisms', 'mca', 'mechanics'],
  },
  {
    id: 'attendance',
    label: 'Attendance',
    metrics: ['pga_total', 'sv1', 'sv2', 'yxp', 'kids', 'local', 'hc1', 'hc2'],
  },
  METRIC_GROUPS[1],
  { id: 'hc', label: 'HC, MCA & Baptisms', metrics: ['hc1', 'hc2', 'mca', 'baptisms'] },
  METRIC_GROUPS[4],
]

/** Raw (stored) metric columns, used for the change-log diff */
export const RAW_METRIC_KEYS: MetricKey[] = [
  'sv1',
  'sv2',
  'yxp',
  'kids',
  'local',
  'hc1',
  'hc2',
  'salvations_livestream_enc',
  'salvations_livestream_yxp',
  'salvations_inhouse',
  'salvations_mc',
  'salvations_other',
  'salvations',
  'baptisms',
  'mca',
  'mechanics',
  'mechanics_get',
  'mechanics_worship',
  'mechanics_training',
]

/** Coerce an RPC value (number, numeric string, null, missing) to a number */
export function num(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/**
 * Read a metric from an RPC row, deriving totals client-side. Returns null when
 * the column isn't in the row at all (e.g. an RPC that doesn't expose
 * mechanics_training) so callers can hide it rather than show fake zeros.
 */
export function metricValue(
  row: Record<string, unknown> | null | undefined,
  key: AnyMetricKey
): number | null {
  if (!row) return null
  if (key === 'pga_total') {
    return (['sv1', 'sv2', 'yxp', 'kids', 'local', 'hc1', 'hc2'] as const).reduce(
      (acc, k) => acc + num(row[k]),
      0
    )
  }
  if (key === 'epga_total') {
    return num(row.sv1) + num(row.sv2) + num(row.yxp)
  }
  if (!(key in row)) return null
  return num(row[key])
}

/** Metrics actually present in at least one row (derived ones always are) */
export function availableMetrics(
  rows: Record<string, unknown>[],
  keys: AnyMetricKey[]
): AnyMetricKey[] {
  if (rows.length === 0) return keys
  return keys.filter(
    (k) => k === 'pga_total' || k === 'epga_total' || rows.some((r) => k in r)
  )
}
