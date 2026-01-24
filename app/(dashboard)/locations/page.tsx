'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LocationsTable } from '@/components/locations/locations-table'
import { CreateLocationDialog } from '@/components/locations/create-location-dialog'
import { useLocations, useFobs } from '@/hooks/use-pga'
import { useUserRole } from '@/hooks/use-user'
import type { LocationWithFob } from '@/types'

export default function LocationsPage() {
  const { data: userRole, isLoading: roleLoading } = useUserRole()
  const { data: locations = [], isLoading: locationsLoading } = useLocations()
  const { data: fobs = [] } = useFobs()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [fobFilter, setFobFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const isAdmin = userRole === 'admin'
  const isManager = userRole === 'manager'
  const isFobLeader = userRole === 'fob_leader'
  const isAdminOrManager = isAdmin || isManager
  const canView = isAdminOrManager || isFobLeader
  const canFilterByFob = isAdminOrManager
  const canEdit = isAdminOrManager || isFobLeader
  const canDelete = isAdmin

  // Filter locations by search and FOB
  const filteredLocations = useMemo(() => {
    return (locations as LocationWithFob[]).filter((location) => {
      const matchesSearch = location.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesFob = fobFilter === 'all' || location.fob?.id === fobFilter
      return matchesSearch && matchesFob
    })
  }, [locations, searchQuery, fobFilter])

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, fobFilter])

  // Pagination calculations
  const totalRows = filteredLocations.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedLocations = filteredLocations.slice(startIndex, endIndex)

  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () =>
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value))
    setCurrentPage(1)
  }

  // Access control: pastors and others cannot see this page
  if (!roleLoading && !canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Manage your church locations and meeting places."
        actions={
          isAdmin && (
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="w-full sm:w-auto bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            >
              Add Location
            </Button>
          )
        }
      />

      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <Card className="rounded-lg">
          <CardContent className="pt-6">
            {/* Search and Filter Controls */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {canFilterByFob && (
                <Select value={fobFilter} onValueChange={setFobFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Filter by FOB" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All FOBs</SelectItem>
                    {fobs.map((fob) => (
                      <SelectItem key={fob.id} value={fob.id}>
                        {fob.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Locations Table */}
            <LocationsTable
              locations={paginatedLocations}
              isLoading={locationsLoading || roleLoading}
              canEdit={canEdit}
              canDelete={canDelete}
            />

            {/* Pagination */}
            <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Rows per page:
                </span>
                <Select
                  value={String(rowsPerPage)}
                  onValueChange={handleRowsPerPageChange}
                >
                  <SelectTrigger className="h-8 w-16 focus:ring-0">
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
                <span className="mr-2 text-sm text-muted-foreground">
                  {totalRows > 0
                    ? `${startIndex + 1}-${Math.min(endIndex, totalRows)} of ${totalRows}`
                    : '0 of 0'}
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

      {/* Create Location Dialog (admin only) */}
      {isAdmin && (
        <CreateLocationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      )}
    </div>
  )
}
