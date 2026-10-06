'use client'

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ROLLING_WINDOW, fmtDate, fmtNumber, type ChartPoint } from './trend-format'

// Recharts 3 sorts tooltip and legend items alphabetically by default; keep
// them in series order (metric first, then the rolling average) as before.
const SERIES_ORDER: Record<string, number> = { value: 0, rolling: 1 }
const seriesRank = (item: { dataKey?: unknown }) => SERIES_ORDER[String(item.dataKey)] ?? 99

/** The trends chart. Loaded on demand by TrendsView (recharts is large). */
export function TrendChart({
  points,
  metricName,
  showRolling,
}: {
  points: ChartPoint[]
  metricName: string
  showRolling: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => fmtDate(v, 'd MMM')}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          stroke="hsl(var(--border))"
          minTickGap={24}
        />
        <YAxis
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          stroke="hsl(var(--border))"
          tickFormatter={(v: number) => fmtNumber(v)}
          width={56}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            borderColor: 'hsl(var(--border))',
            color: 'hsl(var(--popover-foreground))',
            borderRadius: 'var(--radius)',
            fontSize: 12,
          }}
          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
          labelFormatter={(v) => fmtDate(String(v), 'EEE d MMM yyyy')}
          formatter={(v, name) => [fmtNumber(typeof v === 'number' ? v : null, 1), name]}
          itemSorter={seriesRank}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
          itemSorter={seriesRank}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={metricName}
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          fill="url(#trend-fill)"
          dot={points.length <= 26 ? { r: 2.5, fill: 'hsl(var(--chart-1))' } : false}
          activeDot={{ r: 4 }}
          connectNulls
          isAnimationActive={false}
        />
        {showRolling && (
          <Line
            type="monotone"
            dataKey="rolling"
            name={`${ROLLING_WINDOW}-week average`}
            stroke="hsl(var(--chart-4))"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
