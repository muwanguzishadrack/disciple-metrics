'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { ReportsNav } from '@/components/reports/reports-nav'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePgaPeriodTotals } from '@/hooks/use-analytics'
import { exportToExcel, type ExportColumn } from '@/lib/export'
import { cn } from '@/lib/utils'
import {
  currentValue,
  filterCompareRows,
  mergePeriodRows,
  previousValue,
  rowDelta,
  sortCompareRows,
  totalCompareRows,
  type CompareRow,
  type GroupBy,
  type SortKey,
  type SortState,
} from './compare'
import { availableMetrics, COMPARE_GROUPS, METRICS, type AnyMetricKey } from './metrics'
import {
  comparisonRange,
  delta,
  formatRange,
  parseISODate,
  presetBlockMonths,
  resolveComparePreset,
  startOfToday,
  type ComparePreset,
  type ComparisonMode,
  type Delta,
} from './periods'
import { RpcErrorCard, StatusCard } from './status-card'

const PERIODS: { value: ComparePreset; label: string }[] = [
  { value: 'ytd', label: 'Year to date' },
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'custom', label: 'Custom' },
]

const GROUP_BY: { value: GroupBy; label: string; noun: string }[] = [
  { value: 'location', label: 'Location', noun: 'Location' },
  { value: 'fob', label: 'FOB', noun: 'FOB' },
  { value: 'region', label: 'Region', noun: 'Region' },
  { value: 'total', label: 'Total', noun: 'Scope' },
]

const COMPARISONS: { value: ComparisonMode; label: string }[] = [
  { value: 'previous', label: 'Previous period' },
  { value: 'last-year', label: 'Same period last year' },
  { value: 'none', label: 'No comparison' },
]

type SortMeasure = 'value' | 'delta' | 'pct'

const fmtNumber = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-US')

const fmtSigned = (n: number) => (n > 0 ? `+${fmtNumber(n)}` : fmtNumber(n))

const fmtPct = (p: number | null) =>
  p === null ? '' : `${p > 0 ? '+' : ''}${(p * 100).toFixed(1)}%`

function DeltaText({ d }: { d: Delta }) {
  if (d.abs === null) return null
  const tone =
    d.abs > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : d.abs < 0
        ? 'text-destructive'
        : 'text-muted-foreground'
  return (
    <span className={cn('block whitespace-nowrap text-xs tabular-nums', tone)}>
      {fmtSigned(d.abs)}
      {d.pct !== null && ` (${fmtPct(d.pct)})`}
    </span>
  )
}

function sortKeyEquals(a: SortKey, b: SortKey) {
  if (a.kind !== b.kind) return false
  if ('metric' in a && 'metric' in b) return a.metric === b.metric
  return true
}

export function CompareView() {
  const [preset, setPreset] = useState<ComparePreset>('ytd')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [mode, setMode] = useState<ComparisonMode>('last-year')
  const [groupBy, setGroupBy] = useState<GroupBy>('location')
  const [columnSet, setColumnSet] = useState('summary')
  const [search, setSearch] = useState('')
  const [measure, setMeasure] = useState<SortMeasure>('value')
  const [sort, setSort] = useState<SortState>({
    key: { kind: 'value', metric: 'pga_total' },
    dir: 'desc',
  })

  const handlePresetChange = (value: ComparePreset) => {
    setPreset(value)
    // YTD reads best against last year; shorter periods against the one before
    setMode((m) => (m === 'none' ? m : value === 'ytd' ? 'last-year' : 'previous'))
  }

  const range = useMemo(
    () => resolveComparePreset(preset, startOfToday(), { start: customStart, end: customEnd }),
    [preset, customStart, customEnd]
  )
  const compRange = useMemo(
    () => (range ? comparisonRange(range, mode, presetBlockMonths(preset)) : null),
    [range, mode, preset]
  )
  const hasComparison = !!compRange

  const current = usePgaPeriodTotals(range, groupBy)
  const previous = usePgaPeriodTotals(compRange, groupBy)

  const isLoading = current.isLoading || (hasComparison && previous.isLoading)
  const error = current.error ?? (hasComparison ? previous.error : null)

  const merged = useMemo(
    () => mergePeriodRows(current.data ?? [], hasComparison ? previous.data ?? [] : null, groupBy),
    [current.data, previous.data, hasComparison, groupBy]
  )

  const metrics = useMemo(() => {
    const group = COMPARE_GROUPS.find((g) => g.id === columnSet) ?? COMPARE_GROUPS[0]
    return availableMetrics(
      [...(current.data ?? []), ...(previous.data ?? [])],
      group.metrics
    )
  }, [columnSet, current.data, previous.data])

  const visibleRows = useMemo(
    () => sortCompareRows(filterCompareRows(merged, search), sort, hasComparison),
    [merged, search, sort, hasComparison]
  )

  const totals = useMemo(
    () => totalCompareRows(visibleRows, metrics, hasComparison),
    [visibleRows, metrics, hasComparison]
  )

  const groupNoun = GROUP_BY.find((g) => g.value === groupBy)!.noun
  const showFob = groupBy === 'location'
  const showRegion = groupBy === 'location' || groupBy === 'fob'

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      sortKeyEquals(prev.key, key)
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key.kind === 'name' ? 'asc' : 'desc' }
    )
  }

  const metricSortKey = (metric: AnyMetricKey): SortKey =>
    !hasComparison || measure === 'value'
      ? { kind: 'value', metric }
      : { kind: measure, metric }

  const ariaSort = (key: SortKey): 'ascending' | 'descending' | 'none' =>
    sortKeyEquals(sort.key, key) ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (!sortKeyEquals(sort.key, k)) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" aria-hidden="true" />
    return sort.dir === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3" aria-hidden="true" />
      : <ArrowDown className="ml-1 h-3 w-3" aria-hidden="true" />
  }

  const handleExport = () => {
    if (!range) return
    const columns: ExportColumn<CompareRow>[] = [
      { header: groupNoun, accessor: (r) => r.name },
    ]
    if (showFob) columns.push({ header: 'FOB', accessor: (r) => r.fobName, skipTotal: true })
    if (showRegion) columns.push({ header: 'Region', accessor: (r) => r.regionName, skipTotal: true })
    columns.push({ header: 'Reports', accessor: (r) => r.reportCount, skipTotal: true })
    columns.push({ header: 'Entries', accessor: (r) => r.entryCount })
    for (const m of metrics) {
      const label = METRICS[m].label
      columns.push({ header: label, accessor: (r) => currentValue(r, m) })
      if (hasComparison) {
        columns.push({ header: `${label} (prev)`, accessor: (r) => previousValue(r, m, true) ?? 0 })
        columns.push({ header: `${label} Δ`, accessor: (r) => rowDelta(r, m, true).abs ?? 0 })
        columns.push({
          header: `${label} Δ%`,
          accessor: (r) => fmtPct(rowDelta(r, m, true).pct),
          skipTotal: true,
        })
      }
    }
    exportToExcel<CompareRow>({
      data: visibleRows,
      columns,
      sheetName: 'Compare',
      fileName: `pga_${groupBy}_${range.start}_to_${range.end}`,
      includeTotals: groupBy !== 'total',
    })
  }

  return (
    <div>
      <PageHeader
        title="Compare"
        description="Period totals by location, FOB or region, with change vs a comparison period"
        actions={<ReportsNav />}
      />
      <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
        <Card className="rounded-lg">
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="compare-period">Period</Label>
              <Select value={preset} onValueChange={(v) => handlePresetChange(v as ComparePreset)}>
                <SelectTrigger id="compare-period" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compare-mode">Compare with</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as ComparisonMode)}>
                <SelectTrigger id="compare-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARISONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compare-group">Group by</Label>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger id="compare-group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_BY.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compare-columns">Metrics</Label>
              <Select value={columnSet} onValueChange={setColumnSet}>
                <SelectTrigger id="compare-columns" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARE_GROUPS.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {preset === 'custom' && (
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-end lg:col-span-4">
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

            <div className="flex flex-col gap-1 text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
              {range && <span><span className="font-medium text-foreground">Period:</span> {formatRange(range)}</span>}
              {range && compRange && (
                <span><span className="font-medium text-foreground">Compared with:</span> {formatRange(compRange)}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {!range ? (
          <StatusCard title="Pick a date range" description="Choose both a start and an end date." />
        ) : error ? (
          <RpcErrorCard error={error} feature="Compare" />
        ) : (
          <Card className="rounded-lg">
            <CardContent className="space-y-4 pt-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    type="search"
                    placeholder={groupBy === 'location' ? 'Search location, FOB or region' : 'Search'}
                    aria-label="Search rows"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                    disabled={groupBy === 'total'}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {hasComparison && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor="compare-measure" className="whitespace-nowrap text-sm font-normal text-muted-foreground">
                        Sort metrics by
                      </Label>
                      <Select
                        value={measure}
                        onValueChange={(v) => {
                          const m = v as SortMeasure
                          setMeasure(m)
                          setSort((prev) =>
                            'metric' in prev.key
                              ? { ...prev, key: m === 'value' ? { kind: 'value', metric: prev.key.metric } : { kind: m, metric: prev.key.metric } }
                              : prev
                          )
                        }}
                      >
                        <SelectTrigger id="compare-measure" className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="value">Value</SelectItem>
                          <SelectItem value="delta">Change</SelectItem>
                          <SelectItem value="pct">% change</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button variant="outline" onClick={handleExport} disabled={visibleRows.length === 0 || isLoading}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <caption className="sr-only">
                    Totals by {groupNoun.toLowerCase()} for {formatRange(range)}
                    {compRange ? `, compared with ${formatRange(compRange)}` : ''}
                  </caption>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col" aria-sort={ariaSort({ kind: 'name' })} className="min-w-[180px]">
                        <button type="button" className="inline-flex items-center" onClick={() => toggleSort({ kind: 'name' })}>
                          {groupNoun}
                          <SortIcon k={{ kind: 'name' }} />
                        </button>
                      </TableHead>
                      <TableHead scope="col" aria-sort={ariaSort({ kind: 'reports' })} className="text-right">
                        <button type="button" className="inline-flex items-center" onClick={() => toggleSort({ kind: 'reports' })}>
                          Reports
                          <SortIcon k={{ kind: 'reports' }} />
                        </button>
                      </TableHead>
                      {metrics.map((m) => {
                        const k = metricSortKey(m)
                        return (
                          <TableHead key={m} scope="col" aria-sort={ariaSort(k)} className="text-right">
                            <button
                              type="button"
                              className="inline-flex items-center"
                              onClick={() => toggleSort(k)}
                              title={METRICS[m].name}
                            >
                              {METRICS[m].label}
                              <SortIcon k={k} />
                            </button>
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: metrics.length + 2 }).map((__, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-14" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : visibleRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={metrics.length + 2} className="py-8 text-center text-muted-foreground">
                          {search ? 'No rows match your search.' : 'No reports in this period.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleRows.map((row) => (
                        <TableRow key={row.key}>
                          <TableCell>
                            <span className="font-medium">{row.name}</span>
                            {(showFob || showRegion) && (
                              <span className="block text-xs text-muted-foreground">
                                {[showFob ? row.fobName : '', showRegion ? row.regionName : '']
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNumber(row.reportCount)}</TableCell>
                          {metrics.map((m) => (
                            <TableCell key={m} className="text-right align-top">
                              <span className="tabular-nums">{fmtNumber(currentValue(row, m))}</span>
                              {hasComparison && <DeltaText d={rowDelta(row, m, true)} />}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {!isLoading && visibleRows.length > 1 && (
                    <tfoot>
                      <TableRow className="border-t-2 font-semibold">
                        <TableCell>Total ({visibleRows.length})</TableCell>
                        <TableCell />
                        {metrics.map((m) => (
                          <TableCell key={m} className="text-right align-top">
                            <span className="tabular-nums">{fmtNumber(totals.current[m])}</span>
                            {totals.previous && (
                              <DeltaText d={delta(totals.current[m], totals.previous[m])} />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    </tfoot>
                  )}
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Figures are grouped by the FOB and region each entry belonged to when it was submitted.
                {hasComparison && ' Change shows the difference vs the comparison period; % is blank when the comparison value is 0.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
