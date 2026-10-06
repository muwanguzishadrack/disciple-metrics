'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFobs, useLocations, useRegions } from '@/hooks/use-pga'

export interface ScopeValue {
  regionId: string | null
  fobId: string | null
  locationId: string | null
}

export const EMPTY_SCOPE: ScopeValue = { regionId: null, fobId: null, locationId: null }

// Radix Select can't use '' as an item value
const ALL = '__all__'

interface ScopeFilterProps {
  value: ScopeValue
  onChange: (value: ScopeValue) => void
}

/**
 * Cascading Region -> FOB -> Location pickers. Options come from the existing
 * RLS-scoped queries, so each role only ever sees what it can already access.
 * Option lists follow today's arrangement (live location -> FOB -> region);
 * the RPCs filter on the frozen ids stamped on each entry.
 */
export function ScopeFilter({ value, onChange }: ScopeFilterProps) {
  const { data: regions = [] } = useRegions()
  const { data: fobs = [] } = useFobs()
  const { data: locations = [] } = useLocations()

  // Only regions that contain a FOB the user can see (regions are readable by
  // everyone, FOBs are RLS-scoped).
  const regionOptions = useMemo(() => {
    const visible = new Set(fobs.map((f) => f.region?.id).filter(Boolean))
    return fobs.length === 0 ? regions : regions.filter((r) => visible.has(r.id))
  }, [regions, fobs])

  const fobOptions = useMemo(
    () => (value.regionId ? fobs.filter((f) => f.region?.id === value.regionId) : fobs),
    [fobs, value.regionId]
  )

  const locationOptions = useMemo(() => {
    if (value.fobId) return locations.filter((l) => l.fob?.id === value.fobId)
    if (value.regionId) return locations.filter((l) => l.fob?.region?.id === value.regionId)
    return locations
  }, [locations, value.fobId, value.regionId])

  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="scope-region">Region</Label>
        <Select
          value={value.regionId ?? ALL}
          onValueChange={(v) =>
            onChange({ regionId: v === ALL ? null : v, fobId: null, locationId: null })
          }
        >
          <SelectTrigger id="scope-region" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All regions</SelectItem>
            {regionOptions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scope-fob">FOB</Label>
        <Select
          value={value.fobId ?? ALL}
          onValueChange={(v) =>
            onChange({ ...value, fobId: v === ALL ? null : v, locationId: null })
          }
        >
          <SelectTrigger id="scope-fob" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All FOBs</SelectItem>
            {fobOptions.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scope-location">Location</Label>
        <Select
          value={value.locationId ?? ALL}
          onValueChange={(v) => onChange({ ...value, locationId: v === ALL ? null : v })}
        >
          <SelectTrigger id="scope-location" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All locations</SelectItem>
            {locationOptions.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
