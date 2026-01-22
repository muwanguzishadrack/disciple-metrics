'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EditLocationDialog } from './edit-location-dialog'
import { DeleteLocationDialog } from './delete-location-dialog'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { LocationWithFob } from '@/types'

interface LocationsTableProps {
  locations: LocationWithFob[]
  isLoading: boolean
  canEdit: boolean
  canDelete: boolean
}

export function LocationsTable({
  locations,
  isLoading,
  canEdit,
  canDelete,
}: LocationsTableProps) {
  const showActions = canEdit || canDelete
  const [editLocation, setEditLocation] = useState<LocationWithFob | null>(null)
  const [deleteLocation, setDeleteLocation] = useState<LocationWithFob | null>(
    null
  )

  if (isLoading) {
    return (
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[25%]">Name</TableHead>
            <TableHead className="w-[20%]">FOB</TableHead>
            <TableHead className="w-[25%]">Pastor</TableHead>
            <TableHead className="w-[25%]">Contact</TableHead>
            {showActions && <TableHead className="w-[50px]">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              {showActions && (
                <TableCell>
                  <Skeleton className="h-4 w-8" />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  return (
    <>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[25%]">Name</TableHead>
            <TableHead className="w-[20%]">FOB</TableHead>
            <TableHead className="w-[25%]">Pastor</TableHead>
            <TableHead className="w-[25%]">Contact</TableHead>
            {showActions && <TableHead className="w-[50px]">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((location) => (
            <TableRow key={location.id}>
              <TableCell className="font-medium">{location.name}</TableCell>
              <TableCell>{location.fob?.name || '-'}</TableCell>
              <TableCell>{location.pastor || '-'}</TableCell>
              <TableCell>{location.contact || '-'}</TableCell>
              {showActions && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEdit && (
                        <DropdownMenuItem
                          onClick={() => setEditLocation(location)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <DropdownMenuItem
                          onClick={() => setDeleteLocation(location)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
          {locations.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={showActions ? 5 : 4}
                className="py-8 text-center text-muted-foreground"
              >
                No locations found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <EditLocationDialog
        location={editLocation}
        open={!!editLocation}
        onOpenChange={(open) => !open && setEditLocation(null)}
      />

      <DeleteLocationDialog
        location={deleteLocation}
        open={!!deleteLocation}
        onOpenChange={(open) => !open && setDeleteLocation(null)}
      />
    </>
  )
}
