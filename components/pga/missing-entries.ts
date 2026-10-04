import type { MissingPgaEntry } from '@/hooks/use-pga-missing'

export interface FobGroup {
  name: string
  locations: string[]
}

export interface RegionGroup {
  name: string
  count: number
  fobs: FobGroup[]
}

/** Group missing locations by region, then FOB; all levels sorted by name. */
export function groupMissingEntries(rows: MissingPgaEntry[]): RegionGroup[] {
  const regions = new Map<string, Map<string, string[]>>()
  for (const row of rows) {
    const region = row.region_name || 'No region'
    const fob = row.fob_name || 'No FOB'
    if (!regions.has(region)) regions.set(region, new Map())
    const fobs = regions.get(region)!
    if (!fobs.has(fob)) fobs.set(fob, [])
    fobs.get(fob)!.push(row.location_name)
  }
  return Array.from(regions.entries())
    .map(([name, fobs]) => {
      const fobGroups = Array.from(fobs.entries())
        .map(([fobName, locations]) => ({
          name: fobName,
          locations: [...locations].sort((a, b) => a.localeCompare(b)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return {
        name,
        count: fobGroups.reduce((acc, f) => acc + f.locations.length, 0),
        fobs: fobGroups,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
