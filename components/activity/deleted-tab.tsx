'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { RotateCcw } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  useDeletedPgaEntries,
  useDeletedPgaReports,
  useRestorePgaEntry,
  useRestorePgaReport,
  type DeletedEntryRow,
  type DeletedReportRow,
} from '@/hooks/use-activity'
import { useToast } from '@/hooks/use-toast'

type RestoreTarget =
  | { kind: 'report'; row: DeletedReportRow }
  | { kind: 'entry'; row: DeletedEntryRow }

const fmtReportDate = (iso: string) => format(parseISODate(iso), 'd MMM yyyy')
const fmtWhen = (ts: string) => format(new Date(ts), 'd MMM yyyy, HH:mm')

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return 'Restore failed. Please try again.'
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-20" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function DeletedTab() {
  const { toast } = useToast()
  const reports = useDeletedPgaReports(true)
  const entries = useDeletedPgaEntries(true)
  const restoreReport = useRestorePgaReport()
  const restoreEntry = useRestorePgaEntry()
  const [target, setTarget] = useState<RestoreTarget | null>(null)

  const isRestoring = restoreReport.isPending || restoreEntry.isPending

  const handleConfirm = async () => {
    if (!target) return
    try {
      if (target.kind === 'report') {
        const count = await restoreReport.mutateAsync(target.row.report_id)
        toast({
          title: 'Report restored',
          description: `${fmtReportDate(target.row.report_date)} is back with ${count} ${count === 1 ? 'entry' : 'entries'}.`,
        })
      } else {
        await restoreEntry.mutateAsync(target.row.log_id)
        toast({
          title: 'Entry restored',
          description: `${target.row.location_name ?? 'Entry'} for ${fmtReportDate(target.row.report_date)} is back.`,
        })
      }
    } catch (error) {
      toast({ title: 'Restore failed', description: errorMessage(error), variant: 'destructive' })
    } finally {
      setTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Deleted reports</CardTitle>
          <CardDescription>Restoring a report also brings back every entry deleted with it.</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.error ? (
            <RpcErrorCard error={reports.error} feature="Deleted reports" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Report date</TableHead>
                  <TableHead scope="col">Deleted</TableHead>
                  <TableHead scope="col">By</TableHead>
                  <TableHead scope="col" className="text-right">Entries</TableHead>
                  <TableHead scope="col" className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.isLoading ? (
                  <SkeletonRows cols={5} />
                ) : (reports.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      No deleted reports.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.data!.map((row) => (
                    <TableRow key={row.report_id}>
                      <TableCell className="whitespace-nowrap">{fmtReportDate(row.report_date)}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtWhen(row.deleted_at)}</TableCell>
                      <TableCell>{row.deleted_by_name || (row.deleted_by ? 'Unknown user' : 'System')}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.entry_count ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setTarget({ kind: 'report', row })}
                          disabled={isRestoring}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Deleted entries</CardTitle>
          <CardDescription>Individual location entries deleted from a report (most recent 100).</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.error ? (
            <RpcErrorCard error={entries.error} feature="Deleted entries" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Report date</TableHead>
                  <TableHead scope="col">Location</TableHead>
                  <TableHead scope="col">Deleted</TableHead>
                  <TableHead scope="col">By</TableHead>
                  <TableHead scope="col" className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.isLoading ? (
                  <SkeletonRows cols={5} />
                ) : (entries.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      No deleted entries.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.data!.map((row) => (
                    <TableRow key={row.log_id}>
                      <TableCell className="whitespace-nowrap">{fmtReportDate(row.report_date)}</TableCell>
                      <TableCell>{row.location_name ?? 'Unknown location'}</TableCell>
                      <TableCell className="whitespace-nowrap">{fmtWhen(row.deleted_at)}</TableCell>
                      <TableCell>{row.deleted_by_name || (row.deleted_by ? 'Unknown user' : 'System')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTarget({ kind: 'entry', row })}
                            disabled={isRestoring || !row.report_exists}
                            aria-describedby={!row.report_exists ? `entry-hint-${row.log_id}` : undefined}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                          </Button>
                          {!row.report_exists && (
                            <span id={`entry-hint-${row.log_id}`} className="text-xs text-muted-foreground">
                              Restore the {fmtReportDate(row.report_date)} report first
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!target} onOpenChange={(open) => !open && !isRestoring && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.kind === 'report' ? 'Restore report?' : 'Restore entry?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.kind === 'report'
                ? `This brings back the ${fmtReportDate(target.row.report_date)} report and the ${target.row.entry_count ?? 0} ${target.row.entry_count === 1 ? 'entry' : 'entries'} deleted with it, exactly as they were.`
                : target?.kind === 'entry'
                  ? `This brings back ${target.row.location_name ?? 'this location'}'s entry in the ${fmtReportDate(target.row.report_date)} report, exactly as it was. It will fail if that location has since submitted a new entry for the same report.`
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleConfirm()
              }}
              disabled={isRestoring}
            >
              {isRestoring ? 'Restoring…' : 'Restore'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
