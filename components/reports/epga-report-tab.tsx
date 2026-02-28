'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Download, MoreVertical } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { format } from 'date-fns'
import { DatePicker } from '@/components/ui/date-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { useEpgaSummary, useDeletePgaReport, type EpgaSummaryRow } from '@/hooks/use-pga'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/hooks/use-user'
import { exportToExcel } from '@/lib/export'

const dateFilterOptions = [
  { value: 'all-time', label: 'All Time' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'past-3-months', label: 'Past 3 Months' },
  { value: 'custom', label: 'Custom' },
]

interface EpgaReportTabProps {
  actionsContainer?: HTMLDivElement | null
}

export function EpgaReportTab({ actionsContainer }: EpgaReportTabProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { data: userRole } = useUserRole()
  const isAdmin = userRole === 'admin'
  const { data: summaryRows = [], isLoading } = useEpgaSummary()
  const deletePgaReport = useDeletePgaReport()
  const [dateFilter, setDateFilter] = useState('all-time')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [deleteTarget, setDeleteTarget] = useState<EpgaSummaryRow | null>(null)

  useEffect(() => {
    setCurrentPage(1)
  }, [dateFilter, startDate, endDate])

  const getDateRange = (filter: string): { start: Date; end: Date } | null => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (filter) {
      case 'this-month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1)
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        return { start, end }
      }
      case 'last-month': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const end = new Date(today.getFullYear(), today.getMonth(), 0)
        return { start, end }
      }
      case 'past-3-months': {
        const start = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate())
        const end = today
        return { start, end }
      }
      case 'custom': {
        if (!startDate || !endDate) return null
        return { start: new Date(startDate), end: new Date(endDate) }
      }
      default:
        return null
    }
  }

  const filteredRows = summaryRows.filter((row) => {
    const range = getDateRange(dateFilter)
    if (!range) return true
    const [year, month, day] = row.date.split('-').map(Number)
    const reportDate = new Date(year, month - 1, day)
    return reportDate >= range.start && reportDate <= range.end
  })

  const totalRows = filteredRows.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedRows = filteredRows.slice(startIndex, endIndex)

  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value))
    setCurrentPage(1)
  }

  const handleExport = () => {
    exportToExcel<EpgaSummaryRow>({
      data: filteredRows,
      columns: [
        { header: 'Date', accessor: 'date' },
        { header: '1SV', accessor: 'sv1' },
        { header: '2SV', accessor: 'sv2' },
        { header: 'YXP', accessor: 'yxp' },
        { header: 'Total', accessor: 'total' },
      ],
      sheetName: 'EPGA Report',
      fileName: 'epga_report',
      includeTotals: true,
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePgaReport.mutateAsync(deleteTarget.reportId)
      toast({ title: 'Success', description: 'Report deleted successfully' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete report', variant: 'destructive' })
    } finally {
      setDeleteTarget(null)
    }
  }

  const actionButtons = (
    <>
      <Button variant="outline" onClick={handleExport} disabled={filteredRows.length === 0}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
      <Select value={dateFilter} onValueChange={setDateFilter}>
        <SelectTrigger className="w-full sm:w-40 justify-center sm:justify-between">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {dateFilterOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {dateFilter === 'custom' && (
        <>
          <DatePicker
            value={startDate ? new Date(startDate) : undefined}
            onChange={(date) => setStartDate(date ? format(date, 'yyyy-MM-dd') : '')}
            placeholder="Start date"
            className="w-full sm:w-auto justify-center sm:justify-start text-center sm:text-left"
          />
          <span className="text-center">to</span>
          <DatePicker
            value={endDate ? new Date(endDate) : undefined}
            onChange={(date) => setEndDate(date ? format(date, 'yyyy-MM-dd') : '')}
            placeholder="End date"
            className="w-full sm:w-auto justify-center sm:justify-start text-center sm:text-left"
          />
        </>
      )}
    </>
  )

  return (
    <>
      {actionsContainer && createPortal(actionButtons, actionsContainer)}
      <Card className="rounded-lg">
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>1SV</TableHead>
                <TableHead>2SV</TableHead>
                <TableHead>YXP</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedRows.length > 0 ? (
                paginatedRows.map((row) => (
                  <TableRow key={row.reportId}>
                    <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                    <TableCell>{row.sv1}</TableCell>
                    <TableCell>{row.sv2}</TableCell>
                    <TableCell>{row.yxp}</TableCell>
                    <TableCell className="font-semibold">{row.total}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/reports/epga/${row.date}`)}>
                            View
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(row)}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No EPGA data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between mt-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page:</span>
              <Select value={String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
                <SelectTrigger className="w-16 h-8 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground mr-2">
                {totalRows > 0 ? `${startIndex + 1}-${Math.min(endIndex, totalRows)} of ${totalRows}` : '0 of 0'}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToFirstPage} disabled={currentPage === 1 || totalRows === 0}>
                <ChevronFirst className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousPage} disabled={currentPage === 1 || totalRows === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextPage} disabled={currentPage === totalPages || totalRows === 0}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToLastPage} disabled={currentPage === totalPages || totalRows === 0}>
                <ChevronLast className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the report for {deleteTarget?.date}? This will also delete all entries associated with this report. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
