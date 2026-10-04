// Field-level diff for pga_change_log rows: only metric columns, with
// human-readable labels.

import { METRICS, RAW_METRIC_KEYS, type MetricKey } from '@/components/analytics/metrics'

export type ChangeOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE'

export interface FieldChange {
  field: MetricKey
  label: string
  old: number | null
  new: number | null
}

type Json = Record<string, unknown> | null | undefined

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * - UPDATE: metric fields whose value changed (old -> new).
 * - INSERT / RESTORE: the metric values the row came back with (null -> new),
 *   skipping empty ones.
 * - DELETE: the metric values the row had (old -> null), skipping empty ones.
 * Non-metric columns (ids, timestamps, updated_by...) are ignored.
 */
export function diffMetricFields(
  operation: string,
  oldData: Json,
  newData: Json
): FieldChange[] {
  const changes: FieldChange[] = []
  for (const field of RAW_METRIC_KEYS) {
    const hasOld = !!oldData && field in oldData
    const hasNew = !!newData && field in newData
    if (!hasOld && !hasNew) continue
    const oldVal = hasOld ? toNumberOrNull(oldData![field]) : null
    const newVal = hasNew ? toNumberOrNull(newData![field]) : null

    if (operation === 'UPDATE') {
      if (oldVal === newVal) continue
    } else if (operation === 'DELETE') {
      if (oldVal === null || oldVal === 0) continue
    } else {
      // INSERT / RESTORE
      if (newVal === null || newVal === 0) continue
    }

    changes.push({
      field,
      label: METRICS[field].name,
      old: operation === 'INSERT' || operation === 'RESTORE' ? null : oldVal,
      new: operation === 'DELETE' ? null : newVal,
    })
  }
  return changes
}

export const OPERATION_LABELS: Record<string, string> = {
  INSERT: 'Created',
  UPDATE: 'Edited',
  DELETE: 'Deleted',
  RESTORE: 'Restored',
}

export function operationLabel(operation: string): string {
  return OPERATION_LABELS[operation] ?? operation
}
