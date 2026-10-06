'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, CircleAlert, CircleCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMissingPgaEntries } from '@/hooks/use-pga-missing'
import { groupMissingEntries } from './missing-entries'

function formatReportDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface MissingEntriesCardProps {
  reportDate: string
  /** Compact dashboard variant: shows the date and links to the report. */
  compact?: boolean
}

/**
 * "N locations haven't reported" for a report date. Renders nothing while
 * loading or on error (e.g. the RPC isn't deployed yet). Callers gate by role.
 */
export function MissingEntriesCard({ reportDate, compact = false }: MissingEntriesCardProps) {
  const { data, isLoading, isError } = useMissingPgaEntries(reportDate)
  const [expanded, setExpanded] = useState(false)
  const groups = useMemo(() => groupMissingEntries(data ?? []), [data])

  if (isLoading || isError || !data) return null

  const count = data.length
  const dateLabel = compact ? ` for ${formatReportDate(reportDate)}` : ''

  if (count === 0) {
    return (
      <Card className="rounded-lg">
        <CardContent className="flex items-center gap-2 py-4 text-sm">
          <CircleCheck className="h-4 w-4 text-green-600" />
          <span>Every active location has reported{dateLabel}.</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-lg">
      <CardContent className="py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-2 text-left text-sm font-medium"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0" />
            )}
            <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {count} location{count === 1 ? '' : 's'} haven&apos;t reported{dateLabel}
            </span>
          </button>
          {compact && (
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link href={`/reports/${reportDate}`}>View report</Link>
            </Button>
          )}
        </div>

        {expanded && (
          <div className="mt-4 space-y-4">
            {groups.map((region) => (
              <div key={region.name}>
                <p className="text-sm font-semibold">
                  {region.name}{' '}
                  <span className="font-normal text-muted-foreground">({region.count})</span>
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {region.fobs.map((fob) => (
                    <div key={fob.name} className="rounded-md bg-muted/50 p-3">
                      <p className="text-sm font-medium">
                        {fob.name}{' '}
                        <span className="font-normal text-muted-foreground">
                          ({fob.locations.length})
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {fob.locations.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
