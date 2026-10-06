'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
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
import { PageHeader } from '@/components/layout/page-header'
import { ReportsNav } from '@/components/reports/reports-nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePgaTrend } from '@/hooks/use-analytics'
import { METRICS, METRIC_GROUPS, metricValue, type AnyMetricKey } from './metrics'
import {
  formatRange,
  parseISODate,
  resolveTrendPreset,
  rollingAverage,
  startOfToday,
  type TrendPreset,
} from './periods'
import { EMPTY_SCOPE, ScopeFilter, type ScopeValue } from './scope-filter'
import { RpcErrorCard, StatusCard } from './status-card'

const PRESETS: { value: TrendPreset; label: string }[] = [
  { value: 'last-12-weeks', label: 'Last 12 weeks' },
  { value: 'last-6-months', label: 'Last 6 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'last-12-months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
]

const ROLLING_WINDOW = 4

const fmtNumber = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

const fmtDate = (iso: string, pattern = 'd MMM yyyy') => format(parseISODate(iso), pattern)

interface ChartPoint {
  date: string
  value: number | null
  rolling: number | null
  entries: number
}

export function TrendsView() {
  const [preset, setPreset] = useState<TrendPreset>('last-12-weeks')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [metric, setMetric] = useState<AnyMetricKey>('pga_total')
  const [scope, setScope] = useState<ScopeValue>(EMPTY_SCOPE)
  const [showRolling, setShowRolling] = useState(true)
  const [showTable, setShowTable] = useState(false)

  const range = useMemo(
    () => resolveTrendPreset(preset, startOfToday(), { start: customStart, end: customEnd }),
    [preset, customStart, customEnd]
  )

  const { data: rows = [], isLoading, error } = usePgaTrend(range, scope)

  const metricMissing = rows.length > 0 && rows.every((r) => metricValue(r, metric) === null)

  const points: ChartPoint[] = useMemo(() => {
    const values = rows.map((r) => metricValue(r, metric))
    const rolling = rollingAverage(values, ROLLING_WINDOW)
    return rows.map((r, i) => ({
      date: r.report_date,
      value: values[i],
      rolling: rolling[i] === null ? null : Math.round(rolling[i]! * 10) / 10,
      entries: Number(r.entry_count ?? 0),
    }))
  }, [rows, metric])

  const stats = useMemo(() => {
    const vals = points.map((p) => p.value).filter((v): v is number => v !== null)
    if (vals.length === 0) return null
    const total = vals.reduce((a, b) => a + b, 0)
    return {
      total,
      average: total / vals.length,
      latest: vals[vals.length - 1],
      peak: Math.max(...vals),
      reports: vals.length,
    }
  }, [points])

  const metricDef = METRICS[metric]

  return (
    <div>
      <PageHeader
        title="Trends"
        description="Weekly PGA totals over time"
        actions={<ReportsNav />}
      />
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <Card className="rounded-lg">
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="trend-range">Date range</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as TrendPreset)}>
                <SelectTrigger id="trend-range" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trend-metric">Metric</Label>
              <Select value={metric} onValueChange={(v) => setMetric(v as AnyMetricKey)}>
                <SelectTrigger id="trend-metric" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_GROUPS.map((group) => (
                    <SelectGroup key={group.id}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.metrics.map((key) => (
                        <SelectItem key={key} value={key}>
                          {METRICS[key].name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ScopeFilter value={scope} onChange={setScope} />

            {preset === 'custom' && (
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-end lg:col-span-5">
                <div className="space-y-1.5">
                  <Label>From (Sunday)</Label>
                  <DatePicker
                    value={customStart ? parseISODate(customStart) : undefined}
                    onChange={(d) => setCustomStart(d ? format(d, 'yyyy-MM-dd') : '')}
                    placeholder="Start date"
                    className="sm:w-56"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>To (Sunday)</Label>
                  <DatePicker
                    value={customEnd ? parseISODate(customEnd) : undefined}
                    onChange={(d) => setCustomEnd(d ? format(d, 'yyyy-MM-dd') : '')}
                    placeholder="End date"
                    className="sm:w-56"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-6 sm:col-span-2 lg:col-span-5">
              <div className="flex items-center gap-2">
                <Switch id="trend-rolling" checked={showRolling} onCheckedChange={setShowRolling} />
                <Label htmlFor="trend-rolling">{ROLLING_WINDOW}-week rolling average</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="trend-table" checked={showTable} onCheckedChange={setShowTable} />
                <Label htmlFor="trend-table">Show data table</Label>
              </div>
              {range && (
                <span className="text-sm text-muted-foreground">{formatRange(range)}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {!range ? (
          <StatusCard title="Pick a date range" description="Choose both a start and an end date to see the trend." />
        ) : error ? (
          <RpcErrorCard error={error} feature="Trends" />
        ) : isLoading ? (
          <Card className="rounded-lg">
            <CardContent className="pt-6">
              <Skeleton className="h-[320px] w-full" />
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <StatusCard
            title="No reports in this range"
            description="Try a longer date range or a wider scope."
          />
        ) : metricMissing ? (
          <StatusCard
            title={`${metricDef.name} isn't available`}
            description="This metric isn't included in the trend data yet. Pick another metric."
          />
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <StatTile label={`${metricDef.name} — total`} value={fmtNumber(stats.total)} />
                <StatTile label="Average per report" value={fmtNumber(stats.average, 1)} />
                <StatTile label={`Latest (${fmtDate(points[points.length - 1].date, 'd MMM')})`} value={fmtNumber(stats.latest)} />
                <StatTile label="Peak week" value={fmtNumber(stats.peak)} />
              </div>
            )}

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="text-base">{metricDef.name} per report</CardTitle>
              </CardHeader>
              <CardContent>
                <figure
                  role="img"
                  aria-label={`${metricDef.name} for ${points.length} reports, ${range ? formatRange(range) : ''}. ${
                    stats ? `Total ${fmtNumber(stats.total)}, average ${fmtNumber(stats.average, 1)}, latest ${fmtNumber(stats.latest)}.` : ''
                  } Turn on "Show data table" for the figures.`}
                  className="h-[320px] w-full"
                >
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
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }} />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name={metricDef.name}
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
                </figure>
              </CardContent>
            </Card>

            {showTable && (
              <Card className="rounded-lg">
                <CardContent className="pt-6">
                  <Table>
                    <caption className="sr-only">
                      {metricDef.name} per report date{showRolling ? ` with ${ROLLING_WINDOW}-week rolling average` : ''}
                    </caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Report date</TableHead>
                        <TableHead scope="col" className="text-right">{metricDef.name}</TableHead>
                        {showRolling && (
                          <TableHead scope="col" className="text-right">{ROLLING_WINDOW}-week avg</TableHead>
                        )}
                        <TableHead scope="col" className="text-right">Entries</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...points].reverse().map((p) => (
                        <TableRow key={p.date}>
                          <TableCell className="whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNumber(p.value)}</TableCell>
                          {showRolling && (
                            <TableCell className="text-right tabular-nums">{fmtNumber(p.rolling, 1)}</TableCell>
                          )}
                          <TableCell className="text-right tabular-nums">{fmtNumber(p.entries)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="pt-6">
        <p className="truncate text-xs text-muted-foreground" title={label}>{label}</p>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
