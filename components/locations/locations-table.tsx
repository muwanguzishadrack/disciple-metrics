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
import { ArchiveLocationDialog } from './archive-location-dialog'
import { Archive, ArchiveRestore, MoreHorizontal, Pencil } from 'lucide-react'
import type { LocationWithFob } from '@/types'

type TableLocation = LocationWithFob & {
  fob: LocationWithFob['fob'] & { archived_at?: string | null }
}

interface LocationsTableProps {
  locations: TableLocation[]
  isLoading: boolean
  canEdit: boolean
  /** Admin-only: archive (active list) or restore (archived list) */
  canArchive: boolean
  /** Which list this table shows */
  variant?: 'active' | 'archived'
  emptyMessage?: string
}

export function LocationsTable({
  locations,
  isLoading,
  canEdit,
  canArchive,
  variant = 'active',
  emptyMessage = 'No locations found.',
}: LocationsTableProps) {
  const showActions = canEdit || canArchive
  const isArchivedList = variant === 'archived'
  const [editLocation, setEditLocation] = useState<LocationWithFob | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<LocationWithFob | null>(
    null
  )

  if (isLoading) {
    return (
      <Table className="lg:table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="lg:w-[22%]">Name</TableHead>
            <TableHead className="lg:w-[16%]">Region</TableHead>
            <TableHead className="lg:w-[18%]">FOB</TableHead>
            <TableHead className="lg:w-[20%]">Pastor</TableHead>
            <TableHead className="lg:w-[18%]">Contact</TableHead>
            {showActions && <TableHead className="lg:w-[6%] text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
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
      <Table className="lg:table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="lg:w-[22%]">Name</TableHead>
            <TableHead className="lg:w-[16%]">Region</TableHead>
            <TableHead className="lg:w-[18%]">FOB</TableHead>
            <TableHead className="lg:w-[20%]">Pastor</TableHead>
            <TableHead className="lg:w-[18%]">Contact</TableHead>
            {showActions && <TableHead className="lg:w-[6%] text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {locations.map((location) => (
            <TableRow key={location.id}>
              <TableCell className="font-medium">
                {location.name}
                {isArchivedList && location.archived_at && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    Archived {new Date(location.archived_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </TableCell>
              <TableCell>{location.fob?.region?.name || '-'}</TableCell>
              <TableCell>{location.fob?.name || '-'}</TableCell>
              <TableCell>{location.pastor || '-'}</TableCell>
              <TableCell>{location.contact || '-'}</TableCell>
              {showActions && (
                <TableCell className="text-right">
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
                      {canArchive && !isArchivedList && (
                        <DropdownMenuItem
                          onClick={() => setArchiveTarget(location)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      )}
                      {canArchive && isArchivedList && (
                        location.fob?.archived_at ? (
                          // Restoring under a retired FOB would hide it again;
                          // move it to an active FOB via Edit first.
                          <DropdownMenuItem disabled className="max-w-64 whitespace-normal">
                            <ArchiveRestore className="mr-2 h-4 w-4 shrink-0" />
                            Its FOB is archived. Edit it into an active FOB to restore.
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => setArchiveTarget(location)}
                          >
                            <ArchiveRestore className="mr-2 h-4 w-4" />
                            Restore
                          </DropdownMenuItem>
                        )
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
                colSpan={showActions ? 6 : 5}
                className="py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
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

      <ArchiveLocationDialog
        mode={isArchivedList ? 'restore' : 'archive'}
        location={archiveTarget}
        open={!!archiveTarget}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      />
    </>
  )
}
