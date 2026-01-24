'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock, Sparkles, Baby, Globe, Building, TrendingUp, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
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
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/page-header'
import { useProfile, useUserRole, useUserAssignment } from '@/hooks/use-user'
import { usePgaReports, useFobs, useLocations, useCreatePgaEntry, useDeletePgaReport, type PgaReportWithTotals } from '@/hooks/use-pga'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

const dateFilterOptions = [
  { value: 'this-week', label: 'This Week' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'past-3-months', label: 'Past 3 Months' },
]

function getDateRange(filter: string): { start: Date; end: Date } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (filter) {
    case 'this-week': {
      const dayOfWeek = today.getDay()
      const start = new Date(today)
      start.setDate(today.getDate() - dayOfWeek) // Sunday
      const end = new Date(start)
      end.setDate(start.getDate() + 6) // Saturday
      return { start, end }
    }
    case 'last-week': {
      const dayOfWeek = today.getDay()
      const thisWeekStart = new Date(today)
      thisWeekStart.setDate(today.getDate() - dayOfWeek)
      const start = new Date(thisWeekStart)
      start.setDate(thisWeekStart.getDate() - 7)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return { start, end }
    }
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
    default:
      return { start: today, end: today }
  }
}


const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  useProfile()
  const { data: userRole } = useUserRole()
  const { data: userAssignment } = useUserAssignment()
  const isAdmin = userRole === 'admin'
  const isPastor = userRole === 'pastor'
  const isFobLeader = userRole === 'fob_leader'
  const { data: pgaReports = [], isLoading: isReportsLoading } = usePgaReports()
  const { data: fobs = [] } = useFobs()
  const { data: locations = [] } = useLocations()
  const createPgaEntry = useCreatePgaEntry()
  const deletePgaReport = useDeletePgaReport()

  const [dateFilter, setDateFilter] = useState('this-week')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(5)

  // Record PGA Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<PgaReportWithTotals | null>(null)
  const [pgaDate, setPgaDate] = useState('')
  const [pgaFob, setPgaFob] = useState('')
  const [pgaLocation, setPgaLocation] = useState('')
  const [pgaSv1, setPgaSv1] = useState(0)
  const [pgaSv2, setPgaSv2] = useState(0)
  const [pgaYxp, setPgaYxp] = useState(0)
  const [pgaKids, setPgaKids] = useState(0)
  const [pgaLocal, setPgaLocal] = useState(0)
  const [pgaHc1, setPgaHc1] = useState(0)
  const [pgaHc2, setPgaHc2] = useState(0)

  // Build FOB and Location options from database
  const fobOptions = useMemo(() => {
    return fobs.map((fob) => ({ value: fob.id, label: fob.name }))
  }, [fobs])

  const locationOptions = useMemo(() => {
    // Filter locations by selected FOB
    const filtered = pgaFob
      ? locations.filter((loc) => loc.fob_id === pgaFob)
      : locations
    return filtered.map((loc) => ({ value: loc.id, label: loc.name }))
  }, [locations, pgaFob])

  // Pre-populate FOB and location based on user role when dialog opens
  useEffect(() => {
    if (dialogOpen && userAssignment) {
      if (isPastor || isFobLeader) {
        setPgaFob(userAssignment.fobId ?? '')
      }
      if (isPastor) {
        setPgaLocation(userAssignment.locationId ?? '')
      }
    }
  }, [dialogOpen, userAssignment, isPastor, isFobLeader])

  const pgaTotal = useMemo(() => {
    return pgaSv1 + pgaSv2 + pgaYxp + pgaKids + pgaLocal + pgaHc1 + pgaHc2
  }, [pgaSv1, pgaSv2, pgaYxp, pgaKids, pgaLocal, pgaHc1, pgaHc2])

  // Filter reports by date range
  const filteredReports = useMemo(() => {
    const { start, end } = getDateRange(dateFilter)
    return pgaReports.filter((report: { date: string }) => {
      // Parse date as local time to avoid timezone issues
      const [year, month, day] = report.date.split('-').map(Number)
      const reportDate = new Date(year, month - 1, day)
      return reportDate >= start && reportDate <= end
    })
  }, [pgaReports, dateFilter])

  // Calculate totals from filtered reports
  type Totals = { sv1: number; sv2: number; yxp: number; kids: number; local: number; hc1: number; hc2: number; total: number }
  const calculatedTotals = useMemo(() => {
    return filteredReports.reduce(
      (acc: Totals, report: { totals: Totals }) => ({
        sv1: acc.sv1 + report.totals.sv1,
        sv2: acc.sv2 + report.totals.sv2,
        yxp: acc.yxp + report.totals.yxp,
        kids: acc.kids + report.totals.kids,
        local: acc.local + report.totals.local,
        hc1: acc.hc1 + report.totals.hc1,
        hc2: acc.hc2 + report.totals.hc2,
        total: acc.total + report.totals.total,
      }),
      { sv1: 0, sv2: 0, yxp: 0, kids: 0, local: 0, hc1: 0, hc2: 0, total: 0 }
    )
  }, [filteredReports])

  // Build stats array with calculated values
  const stats = useMemo(() => [
    { title: '1st Service', value: calculatedTotals.sv1.toLocaleString(), icon: Clock },
    { title: '2nd Service', value: calculatedTotals.sv2.toLocaleString(), icon: Clock },
    { title: 'YXP', value: calculatedTotals.yxp.toLocaleString(), icon: Sparkles },
    { title: 'Kids', value: calculatedTotals.kids.toLocaleString(), icon: Baby },
    { title: 'Local', value: calculatedTotals.local.toLocaleString(), icon: Globe },
    { title: 'Hosting Center 1', value: calculatedTotals.hc1.toLocaleString(), icon: Building },
    { title: 'Hosting Center 2', value: calculatedTotals.hc2.toLocaleString(), icon: Building },
    { title: 'Overall', value: calculatedTotals.total.toLocaleString(), icon: TrendingUp },
  ], [calculatedTotals])

  const resetPgaForm = () => {
    setPgaDate('')
    setPgaFob('')
    setPgaLocation('')
    setPgaSv1(0)
    setPgaSv2(0)
    setPgaYxp(0)
    setPgaKids(0)
    setPgaLocal(0)
    setPgaHc1(0)
    setPgaHc2(0)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      resetPgaForm()
    }
  }

  const handleSubmitPga = async () => {
    if (!pgaDate || !pgaLocation) {
      toast({
        title: 'Missing fields',
        description: 'Please select a date and location',
        variant: 'destructive',
      })
      return
    }

    try {
      await createPgaEntry.mutateAsync({
        date: pgaDate,
        locationId: pgaLocation,
        sv1: pgaSv1,
        sv2: pgaSv2,
        yxp: pgaYxp,
        kids: pgaKids,
        local: pgaLocal,
        hc1: pgaHc1,
        hc2: pgaHc2,
      })
      toast({
        title: 'Success',
        description: 'PGA entry recorded successfully',
      })
      setDialogOpen(false)
      resetPgaForm()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to record PGA entry',
        variant: 'destructive',
      })
    }
  }

  // Use a simple greeting since we no longer have first name
  const greeting = 'Welcome back!'

  // Pagination calculations
  const totalRows = pgaReports.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedReports = pgaReports.slice(startIndex, endIndex)

  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value))
    setCurrentPage(1)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePgaReport.mutateAsync(deleteTarget.id)
      toast({
        title: 'Success',
        description: 'Report deleted successfully',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete report',
        variant: 'destructive',
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <PageHeader
        title={greeting}
        description="Here's an overview of your discipleship metrics."
        actions={
          <>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-40 justify-center sm:justify-between border-[hsl(var(--header-fg)/0.3)] bg-[hsl(var(--header-fg)/0.1)] text-[hsl(var(--header-fg))]">
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
            <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                  Record PGA
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Record PGA</DialogTitle>
                  <DialogDescription>
                    Enter the attendance data for this service.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {/* Date */}
                  <div className="grid gap-2">
                    <Label htmlFor="pga-date">Date</Label>
                    <DatePicker
                      value={pgaDate ? new Date(pgaDate) : undefined}
                      onChange={(date) =>
                        setPgaDate(date ? format(date, 'yyyy-MM-dd') : '')
                      }
                      placeholder="Select date"
                    />
                  </div>

                  {/* FOB and Location */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>FOB</Label>
                      {isPastor || isFobLeader ? (
                        <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
                          {userAssignment?.fobName ?? 'Loading...'}
                        </div>
                      ) : (
                        <Combobox
                          options={fobOptions}
                          value={pgaFob}
                          onValueChange={setPgaFob}
                          placeholder="Select FOB..."
                          searchPlaceholder="Search FOB..."
                        />
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label>Location</Label>
                      {isPastor ? (
                        <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
                          {userAssignment?.locationName ?? 'Loading...'}
                        </div>
                      ) : (
                        <Combobox
                          options={locationOptions}
                          value={pgaLocation}
                          onValueChange={setPgaLocation}
                          placeholder="Select location..."
                          searchPlaceholder="Search location..."
                        />
                      )}
                    </div>
                  </div>

                  {/* Attendance Numbers */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pga-sv1">1st Service (1SV)</Label>
                      <Input
                        id="pga-sv1"
                        type="number"
                        min="0"
                        value={pgaSv1}
                        onChange={(e) => setPgaSv1(Number(e.target.value) || 0)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pga-sv2">2nd Service (2SV)</Label>
                      <Input
                        id="pga-sv2"
                        type="number"
                        min="0"
                        value={pgaSv2}
                        onChange={(e) => setPgaSv2(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pga-yxp">YXP</Label>
                      <Input
                        id="pga-yxp"
                        type="number"
                        min="0"
                        value={pgaYxp}
                        onChange={(e) => setPgaYxp(Number(e.target.value) || 0)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pga-kids">Kids</Label>
                      <Input
                        id="pga-kids"
                        type="number"
                        min="0"
                        value={pgaKids}
                        onChange={(e) => setPgaKids(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pga-local">Local</Label>
                      <Input
                        id="pga-local"
                        type="number"
                        min="0"
                        value={pgaLocal}
                        onChange={(e) => setPgaLocal(Number(e.target.value) || 0)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="pga-hc1">Hosting Center 1 (HC1)</Label>
                      <Input
                        id="pga-hc1"
                        type="number"
                        min="0"
                        value={pgaHc1}
                        onChange={(e) => setPgaHc1(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="pga-hc2">Hosting Center 2 (HC2)</Label>
                      <Input
                        id="pga-hc2"
                        type="number"
                        min="0"
                        value={pgaHc2}
                        onChange={(e) => setPgaHc2(Number(e.target.value) || 0)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Total</Label>
                      <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-medium">
                        {pgaTotal}
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitPga} disabled={createPgaEntry.isPending}>
                    {createPgaEntry.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <Card className="rounded-lg">
              <div className="flex items-stretch p-4">
                <div className="flex-1 flex flex-col justify-center">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className="text-xl font-medium">{stat.value}</div>
                </div>
                <div className="flex items-center justify-center rounded-lg h-12 w-12 bg-[#008cff]/10">
                  <stat.icon className="h-6 w-6 text-[#008cff] stroke-[1.5]" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

        {/* Recent PGA Reports Table */}
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="text-xl font-medium">Recent PGA Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <Table className="lg:table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="lg:w-[12%] whitespace-nowrap">Date</TableHead>
                  <TableHead className="lg:w-[8%]">1SV</TableHead>
                  <TableHead className="lg:w-[8%]">2SV</TableHead>
                  <TableHead className="lg:w-[8%]">YXP</TableHead>
                  <TableHead className="lg:w-[8%]">Kids</TableHead>
                  <TableHead className="lg:w-[8%]">Local</TableHead>
                  <TableHead className="lg:w-[8%]">HC1</TableHead>
                  <TableHead className="lg:w-[8%]">HC2</TableHead>
                  <TableHead className="lg:w-[10%]">Total</TableHead>
                  <TableHead className="lg:w-[70px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isReportsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-12" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedReports.length > 0 ? (
                  paginatedReports.map((report: PgaReportWithTotals) => (
                    <TableRow key={report.id}>
                      <TableCell className="whitespace-nowrap">{report.date}</TableCell>
                      <TableCell>{report.totals.sv1}</TableCell>
                      <TableCell>{report.totals.sv2}</TableCell>
                      <TableCell>{report.totals.yxp}</TableCell>
                      <TableCell>{report.totals.kids}</TableCell>
                      <TableCell>{report.totals.local}</TableCell>
                      <TableCell>{report.totals.hc1}</TableCell>
                      <TableCell>{report.totals.hc2}</TableCell>
                      <TableCell className="font-medium">{report.totals.total}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/reports/${report.date}`)}>
                              View
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(report)}
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
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No reports yet. Click &quot;Record PGA&quot; to add your first report.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

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
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToFirstPage}
                  disabled={currentPage === 1 || totalRows === 0}
                >
                  <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1 || totalRows === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages || totalRows === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goToLastPage}
                  disabled={currentPage === totalPages || totalRows === 0}
                >
                  <ChevronLast className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
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
