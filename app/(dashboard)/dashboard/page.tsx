'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Clock, Sparkles, Baby, Globe, Building, TrendingUp, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/layout/page-header'
import { useProfile } from '@/hooks/use-user'

const dateFilterOptions = [
  { value: 'this-week', label: 'This Week' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'past-3-months', label: 'Past 3 Months' },
]

const fobOptions = [
  { value: 'fob-1', label: 'FOB 1' },
  { value: 'fob-2', label: 'FOB 2' },
  { value: 'fob-3', label: 'FOB 3' },
  { value: 'fob-4', label: 'FOB 4' },
  { value: 'fob-5', label: 'FOB 5' },
]

const locationOptions = [
  { value: 'location-1', label: 'Location 1' },
  { value: 'location-2', label: 'Location 2' },
  { value: 'location-3', label: 'Location 3' },
  { value: 'location-4', label: 'Location 4' },
  { value: 'location-5', label: 'Location 5' },
]

const stats = [
  { title: '1st Service', value: '0', icon: Clock },
  { title: '2nd Service', value: '0', icon: Clock },
  { title: 'YXP', value: '0', icon: Sparkles },
  { title: 'Kids', value: '0', icon: Baby },
  { title: 'Local', value: '0', icon: Globe },
  { title: 'Hosting Center 1', value: '0', icon: Building },
  { title: 'Hosting Center 2', value: '0', icon: Building },
  { title: 'Overall', value: '0', icon: TrendingUp },
]

const recentReports: {
  id: string
  date: string
  sv1: number
  sv2: number
  yxp: number
  kids: number
  local: number
  hc1: number
  hc2: number
  total: number
}[] = []

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
  const { data: profile, isLoading } = useProfile()
  const [dateFilter, setDateFilter] = useState('this-week')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(5)

  // Record PGA Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
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

  const pgaTotal = useMemo(() => {
    return pgaSv1 + pgaSv2 + pgaYxp + pgaKids + pgaLocal + pgaHc1 + pgaHc2
  }, [pgaSv1, pgaSv2, pgaYxp, pgaKids, pgaLocal, pgaHc1, pgaHc2])

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

  const firstName = profile?.first_name || 'there'

  // Pagination calculations
  const totalRows = recentReports.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedReports = recentReports.slice(startIndex, endIndex)

  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value))
    setCurrentPage(1)
  }

  return (
    <>
      <PageHeader
        title={
          isLoading ? (
            <Skeleton className="h-8 w-48 bg-primary-foreground/20" />
          ) : (
            `Welcome back, ${firstName}!`
          )
        }
        description="Here's an overview of your discipleship metrics."
        actions={
          <>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40 border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground">
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
                <Button className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
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
                    <Input
                      id="pga-date"
                      type="date"
                      value={pgaDate}
                      onChange={(e) => setPgaDate(e.target.value)}
                    />
                  </div>

                  {/* FOB and Location */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>FOB</Label>
                      <Combobox
                        options={fobOptions}
                        value={pgaFob}
                        onValueChange={setPgaFob}
                        placeholder="Select FOB..."
                        searchPlaceholder="Search FOB..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Location</Label>
                      <Combobox
                        options={locationOptions}
                        value={pgaLocation}
                        onValueChange={setPgaLocation}
                        placeholder="Select location..."
                        searchPlaceholder="Search location..."
                      />
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

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setDialogOpen(false)}>
                    Save
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>1SV</TableHead>
                  <TableHead>2SV</TableHead>
                  <TableHead>YXP</TableHead>
                  <TableHead>Kids</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>HC1</TableHead>
                  <TableHead>HC2</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReports.length > 0 ? (
                  paginatedReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>{report.date}</TableCell>
                      <TableCell>{report.sv1}</TableCell>
                      <TableCell>{report.sv2}</TableCell>
                      <TableCell>{report.yxp}</TableCell>
                      <TableCell>{report.kids}</TableCell>
                      <TableCell>{report.local}</TableCell>
                      <TableCell>{report.hc1}</TableCell>
                      <TableCell>{report.hc2}</TableCell>
                      <TableCell className="font-medium">{report.total}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      No reports yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
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
    </>
  )
}
