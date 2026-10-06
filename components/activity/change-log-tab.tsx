'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RpcErrorCard } from '@/components/analytics/status-card'
import { parseISODate } from '@/components/analytics/periods'
import { usePgaChangeLog, type ChangeLogRow } from '@/hooks/use-activity'
import { useLocations } from '@/hooks/use-pga'
import { cn } from '@/lib/utils'
import { diffMetricFields, operationLabel } from './diff'

const PAGE_SIZE = 25
const ALL_LOCATIONS = '__all__'

const OPERATION_STYLES: Record<string, string> = {
  INSERT: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  UPDATE: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  DELETE: 'bg-destructive/15 text-destructive',
  RESTORE: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
}

const fmtValue = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-US'))

function ChangeDetails({ row }: { row: ChangeLogRow }) {
  const changes = diffMetricFields(row.operation, row.old_data, row.new_data)

  if (row.table_name === 'pga_reports') {
    return (
      <span className="text-muted-foreground">
        Whole report {operationLabel(row.operation).toLowerCase()}
        {row.operation === 'DELETE' && ' (with its entries)'}
      </span>
    )
  }
  if (changes.length === 0) {
    return (
      <span className="text-muted-foreground">
        {row.operation === 'UPDATE' ? 'No metric values changed' : 'All metrics empty'}
      </span>
    )
  }
  return (
    <ul className="space-y-0.5">
      {changes.map((c) => (
        <li key={c.field} className="whitespace-nowrap">
          <span className="text-muted-foreground">{c.label}:</span>{' '}
          {row.operation === 'UPDATE' ? (
            <>
              <span className="tabular-nums line-through decoration-muted-foreground/60">{fmtValue(c.old)}</span>
              {' → '}
              <span className="font-medium tabular-nums">{fmtValue(c.new)}</span>
            </>
          ) : (
            <span className="font-medium tabular-nums">
              {fmtValue(row.operation === 'DELETE' ? c.old : c.new)}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function ChangeLogTab() {
  const today = new Date()
  const [from, setFrom] = useState(format(subDays(today, 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(today, 'yyyy-MM-dd'))
  const [locationId, setLocationId] = useState(ALL_LOCATIONS)
  const [page, setPage] = useState(0)

  useEffect(() => setPage(0), [from, to, locationId])

  const { data: locations = [] } = useLocations()
  const locationOptions = useMemo(
    () => [
      { value: ALL_LOCATIONS, label: 'All locations' },
      ...locations.map((l) => ({ value: l.id, label: l.name })),
    ],
    [locations]
  )

  const { data, isLoading, isFetching, error } = usePgaChangeLog(
    {
      from: from || null,
      to: to || null,
      locationId: locationId === ALL_LOCATIONS ? null : locationId,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    true
  )

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <Card className="rounded-lg">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="log-from">Changed from</Label>
            <Input id="log-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="log-to">Changed to</Label>
            <Input id="log-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Combobox
              options={locationOptions}
              value={locationId}
              onValueChange={setLocationId}
              placeholder="All locations"
              searchPlaceholder="Search locations…"
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <RpcErrorCard error={error} feature="Change history" />
      ) : (
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <div className={cn('overflow-x-auto transition-opacity', isFetching && !isLoading && 'opacity-60')}>
              <Table>
                <caption className="sr-only">PGA change history, newest first</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">When</TableHead>
                    <TableHead scope="col">Who</TableHead>
                    <TableHead scope="col">Report</TableHead>
                    <TableHead scope="col">Location</TableHead>
                    <TableHead scope="col">Action</TableHead>
                    <TableHead scope="col">Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No changes recorded for these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap align-top">
                          {format(new Date(row.changed_at), 'd MMM yyyy, HH:mm')}
                        </TableCell>
                        <TableCell className="align-top">
                          {row.changed_by_name || (row.changed_by ? 'Unknown user' : 'System')}
                        </TableCell>
                        <TableCell className="whitespace-nowrap align-top">
                          {row.report_date ? format(parseISODate(row.report_date), 'd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell className="align-top">
                          {row.table_name === 'pga_reports' ? (
                            <span className="text-muted-foreground">Whole report</span>
                          ) : (
                            row.location_name || '—'
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <span
                            className={cn(
                              'inline-block rounded-md px-2 py-0.5 text-xs font-medium',
                              OPERATION_STYLES[row.operation] ?? 'bg-muted text-muted-foreground'
                            )}
                          >
                            {operationLabel(row.operation)}
                          </span>
                        </TableCell>
                        <TableCell className="align-top text-sm">
                          <ChangeDetails row={row} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {total > 0
                  ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString('en-US')}`
                  : '0 changes'}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || isFetching}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || isFetching}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
