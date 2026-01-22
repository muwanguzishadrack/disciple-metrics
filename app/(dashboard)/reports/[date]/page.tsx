'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Sparkles, Baby, Globe, Building, TrendingUp, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Download, MoreVertical, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { usePgaReportByDate, useFobs, useLocations, useUpdatePgaEntry, useDeletePgaEntry, type LocationEntry, type LocationEntryWithStatus } from '@/hooks/use-pga'
import { useToast } from '@/hooks/use-toast'
import { useUserRole } from '@/hooks/use-user'
import { exportToExcel } from '@/lib/export'

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

export default function SingleReportPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: userRole } = useUserRole()
  const isAdmin = userRole === 'admin'
  const isFobLeader = userRole === 'fob_leader'
  const canSearchLocations = isAdmin || isFobLeader
  const canFilterByFob = isAdmin
  const reportDate = params.date as string
  const { data: report, isLoading } = usePgaReportByDate(reportDate)
  const { data: fobs = [] } = useFobs()
  const { data: allLocations = [], isLoading: isLoadingLocations } = useLocations()
  const updatePgaEntry = useUpdatePgaEntry()
  const deletePgaEntry = useDeletePgaEntry()

  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [fobFilter, setFobFilter] = useState('all')

  // Build FOB options from database
  const fobOptions = useMemo(() => {
    return fobs.map((fob) => ({ value: fob.name, label: fob.name }))
  }, [fobs])

  // Merge submitted entries with all locations to show complete list
  const allLocationsWithEntries = useMemo((): LocationEntryWithStatus[] => {
    if (!allLocations.length) return []

    // Create a map of submitted entries by location ID
    const submittedMap = new Map(
      report?.locations.map((entry) => [entry.locationId, entry]) ?? []
    )

    return allLocations.map((loc) => {
      const entry = submittedMap.get(loc.id)
      if (entry) {
        return {
          ...entry,
          hasSubmitted: true,
        }
      }
      return {
        id: null,
        fob: loc.fob.name,
        fobId: loc.fob.id,
        location: loc.name,
        locationId: loc.id,
        sv1: null,
        sv2: null,
        yxp: null,
        kids: null,
        local: null,
        hc1: null,
        hc2: null,
        total: null,
        hasSubmitted: false,
      }
    })
  }, [report, allLocations])

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<LocationEntry | null>(null)
  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<LocationEntry | null>(null)
  const [editSv1, setEditSv1] = useState(0)
  const [editSv2, setEditSv2] = useState(0)
  const [editYxp, setEditYxp] = useState(0)
  const [editKids, setEditKids] = useState(0)
  const [editLocal, setEditLocal] = useState(0)
  const [editHc1, setEditHc1] = useState(0)
  const [editHc2, setEditHc2] = useState(0)

  const editTotal = useMemo(() => {
    return editSv1 + editSv2 + editYxp + editKids + editLocal + editHc1 + editHc2
  }, [editSv1, editSv2, editYxp, editKids, editLocal, editHc1, editHc2])

  const handleEditClick = (location: LocationEntry) => {
    setEditingLocation(location)
    setEditSv1(location.sv1)
    setEditSv2(location.sv2)
    setEditYxp(location.yxp)
    setEditKids(location.kids)
    setEditLocal(location.local)
    setEditHc1(location.hc1)
    setEditHc2(location.hc2)
    setEditDialogOpen(true)
  }

  const handleEditDialogClose = () => {
    setEditDialogOpen(false)
    setEditingLocation(null)
  }

  const handleUpdate = async () => {
    if (!editingLocation) return

    try {
      await updatePgaEntry.mutateAsync({
        id: editingLocation.id,
        sv1: editSv1,
        sv2: editSv2,
        yxp: editYxp,
        kids: editKids,
        local: editLocal,
        hc1: editHc1,
        hc2: editHc2,
      })
      toast({
        title: 'Success',
        description: 'Entry updated successfully',
      })
      handleEditDialogClose()
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update entry',
        variant: 'destructive',
      })
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePgaEntry.mutateAsync(deleteTarget.id)
      toast({
        title: 'Success',
        description: 'Entry deleted successfully',
      })
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete entry',
        variant: 'destructive',
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  // Filter and sort locations: submitted first (by total desc), then not-submitted (alphabetically)
  const filteredLocations = useMemo(() => {
    return allLocationsWithEntries
      .filter((location) => {
        const matchesSearch = location.location.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesFob = fobFilter === 'all' || location.fob === fobFilter
        return matchesSearch && matchesFob
      })
      .sort((a, b) => {
        // Submitted entries come first
        if (a.hasSubmitted && !b.hasSubmitted) return -1
        if (!a.hasSubmitted && b.hasSubmitted) return 1
        // Among submitted entries, sort by total (highest first)
        if (a.hasSubmitted && b.hasSubmitted) {
          return (b.total ?? 0) - (a.total ?? 0)
        }
        // Among not-submitted entries, sort alphabetically by location name
        return a.location.localeCompare(b.location)
      })
  }, [allLocationsWithEntries, searchQuery, fobFilter])

  // Pagination calculations
  const totalRows = filteredLocations.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedLocations = filteredLocations.slice(startIndex, endIndex)

  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value))
    setCurrentPage(1)
  }

  const handleExportLocations = () => {
    // Transform data for export, converting nulls to empty strings
    const exportData = filteredLocations.map((loc, index) => ({
      number: index + 1,
      location: loc.location,
      fob: loc.fob,
      sv1: loc.hasSubmitted ? loc.sv1 : '',
      sv2: loc.hasSubmitted ? loc.sv2 : '',
      yxp: loc.hasSubmitted ? loc.yxp : '',
      kids: loc.hasSubmitted ? loc.kids : '',
      local: loc.hasSubmitted ? loc.local : '',
      hc1: loc.hasSubmitted ? loc.hc1 : '',
      hc2: loc.hasSubmitted ? loc.hc2 : '',
      total: loc.hasSubmitted ? loc.total : '',
    }))

    exportToExcel({
      data: exportData,
      columns: [
        { header: '#', accessor: 'number', skipTotal: true },
        { header: 'Location', accessor: 'location', skipTotal: true },
        { header: 'FOB', accessor: 'fob', skipTotal: true },
        { header: '1SV', accessor: 'sv1' },
        { header: '2SV', accessor: 'sv2' },
        { header: 'YXP', accessor: 'yxp' },
        { header: 'Kids', accessor: 'kids' },
        { header: 'Local', accessor: 'local' },
        { header: 'HC1', accessor: 'hc1' },
        { header: 'HC2', accessor: 'hc2' },
        { header: 'Total', accessor: 'total' },
      ],
      sheetName: 'Location Report',
      fileName: `pga_report_${reportDate}`,
      includeTotals: true,
    })
  }

  if (isLoading || isLoadingLocations) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Report not found for {reportDate}</p>
      </div>
    )
  }

  const stats = [
    { title: '1st Service', value: report.totals.sv1, icon: Clock },
    { title: '2nd Service', value: report.totals.sv2, icon: Clock },
    { title: 'YXP', value: report.totals.yxp, icon: Sparkles },
    { title: 'Kids', value: report.totals.kids, icon: Baby },
    { title: 'Local', value: report.totals.local, icon: Globe },
    { title: 'Hosting Center 1', value: report.totals.hc1, icon: Building },
    { title: 'Hosting Center 2', value: report.totals.hc2, icon: Building },
    { title: 'Overall', value: report.totals.total, icon: TrendingUp },
  ]

  // Format date for display
  const formattedDate = new Date(report.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div>
      <PageHeader
        title={formattedDate}
        description="PGA Report Details"
        actions={
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        {/* Stats Cards */}
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

        {/* Locations Table */}
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            {/* Search and Filter Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              {canSearchLocations && (
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search location..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="pl-9"
                  />
                </div>
              )}
              <div className="flex w-full sm:w-auto items-center gap-2">
                {canFilterByFob && (
                  <Select value={fobFilter} onValueChange={(value) => {
                    setFobFilter(value)
                    setCurrentPage(1)
                  }}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All FOBs</SelectItem>
                      {fobOptions.map((fob) => (
                        <SelectItem key={fob.value} value={fob.value}>
                          {fob.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handleExportLocations}
                  disabled={filteredLocations.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>

            <Table className="lg:table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="lg:w-[16%]">Location</TableHead>
                  <TableHead className="lg:w-[8%]">1SV</TableHead>
                  <TableHead className="lg:w-[8%]">2SV</TableHead>
                  <TableHead className="lg:w-[8%]">YXP</TableHead>
                  <TableHead className="lg:w-[8%]">Kids</TableHead>
                  <TableHead className="lg:w-[8%]">Local</TableHead>
                  <TableHead className="lg:w-[8%]">HC1</TableHead>
                  <TableHead className="lg:w-[8%]">HC2</TableHead>
                  <TableHead className="lg:w-[10%]">Total</TableHead>
                  {(isAdmin || isFobLeader) && <TableHead className="lg:w-[70px]">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLocations.length > 0 ? (
                  paginatedLocations.map((location, index) => (
                    <TableRow key={index} className={!location.hasSubmitted ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{location.location}</TableCell>
                      <TableCell>{location.hasSubmitted ? location.sv1 : '—'}</TableCell>
                      <TableCell>{location.hasSubmitted ? location.sv2 : '—'}</TableCell>
                      <TableCell>{location.hasSubmitted ? location.yxp : '—'}</TableCell>
                      <TableCell>{location.hasSubmitted ? location.kids : '—'}</TableCell>
                      <TableCell>{location.hasSubmitted ? location.local : '—'}</TableCell>
                      <TableCell>{location.hasSubmitted ? location.hc1 : '—'}</TableCell>
                      <TableCell>{location.hasSubmitted ? location.hc2 : '—'}</TableCell>
                      <TableCell className="font-medium">{location.hasSubmitted ? location.total : '—'}</TableCell>
                      {(isAdmin || isFobLeader) && (
                        <TableCell>
                          {location.hasSubmitted ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditClick(location as LocationEntry)}>
                                  Edit
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteTarget(location as LocationEntry)}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not Reported</span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={(isAdmin || isFobLeader) ? 10 : 9} className="text-center text-muted-foreground py-8">
                      No locations found
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

      {/* Edit PGA Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit PGA</DialogTitle>
            <DialogDescription>
              Update the attendance data for {editingLocation?.location}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* FOB and Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>FOB</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
                  {editingLocation?.fob}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Location</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted px-3 text-sm">
                  {editingLocation?.location}
                </div>
              </div>
            </div>

            {/* Attendance Numbers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-sv1">1st Service (1SV)</Label>
                <Input
                  id="edit-sv1"
                  type="number"
                  min="0"
                  value={editSv1}
                  onChange={(e) => setEditSv1(Number(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-sv2">2nd Service (2SV)</Label>
                <Input
                  id="edit-sv2"
                  type="number"
                  min="0"
                  value={editSv2}
                  onChange={(e) => setEditSv2(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-yxp">YXP</Label>
                <Input
                  id="edit-yxp"
                  type="number"
                  min="0"
                  value={editYxp}
                  onChange={(e) => setEditYxp(Number(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-kids">Kids</Label>
                <Input
                  id="edit-kids"
                  type="number"
                  min="0"
                  value={editKids}
                  onChange={(e) => setEditKids(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-local">Local</Label>
                <Input
                  id="edit-local"
                  type="number"
                  min="0"
                  value={editLocal}
                  onChange={(e) => setEditLocal(Number(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-hc1">Hosting Center 1 (HC1)</Label>
                <Input
                  id="edit-hc1"
                  type="number"
                  min="0"
                  value={editHc1}
                  onChange={(e) => setEditHc1(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-hc2">Hosting Center 2 (HC2)</Label>
                <Input
                  id="edit-hc2"
                  type="number"
                  min="0"
                  value={editHc2}
                  onChange={(e) => setEditHc2(Number(e.target.value) || 0)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Total</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-medium">
                  {editTotal}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={handleEditDialogClose}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updatePgaEntry.isPending}>
              {updatePgaEntry.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the entry for {deleteTarget?.location}? This action cannot be undone.
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
    </div>
  )
}
