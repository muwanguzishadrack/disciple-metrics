import { format } from 'date-fns'
import { parseISODate } from './periods'

export const ROLLING_WINDOW = 4

export interface ChartPoint {
  date: string
  value: number | null
  rolling: number | null
  entries: number
}

export const fmtNumber = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

export const fmtDate = (iso: string, pattern = 'd MMM yyyy') => format(parseISODate(iso), pattern)
