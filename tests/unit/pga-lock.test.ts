import { describe, it, expect } from 'vitest'
import {
  isPgaReportDateLocked,
  nairobiToday,
  pgaLockMessage,
  subtractDays,
} from '@/components/pga/pga-lock'
import { groupMissingEntries } from '@/components/pga/missing-entries'

describe('nairobiToday', () => {
  it('uses the Nairobi calendar date (UTC+3)', () => {
    // 22:30 UTC on Oct 4 is already Oct 5 in Nairobi
    expect(nairobiToday(new Date('2026-10-04T22:30:00Z'))).toBe('2026-10-05')
    expect(nairobiToday(new Date('2026-10-04T20:59:00Z'))).toBe('2026-10-04')
  })
})

describe('subtractDays', () => {
  it('crosses month and year boundaries', () => {
    expect(subtractDays('2026-03-01', 1)).toBe('2026-02-28')
    expect(subtractDays('2026-01-05', 14)).toBe('2025-12-22')
    expect(subtractDays('2026-10-04', 0)).toBe('2026-10-04')
  })
})

describe('isPgaReportDateLocked', () => {
  const now = new Date('2026-10-04T09:00:00Z') // Nairobi: 2026-10-04

  it('locks dates strictly older than today - N', () => {
    // cutoff = 2026-09-20
    expect(isPgaReportDateLocked('2026-09-19', 14, now)).toBe(true)
    expect(isPgaReportDateLocked('2026-09-20', 14, now)).toBe(false)
    expect(isPgaReportDateLocked('2026-10-04', 14, now)).toBe(false)
  })

  it('follows the Nairobi date, not UTC', () => {
    const lateUtc = new Date('2026-10-04T22:00:00Z') // Nairobi: 2026-10-05, cutoff 2026-09-21
    expect(isPgaReportDateLocked('2026-09-20', 14, lateUtc)).toBe(true)
  })

  it('never locks when the setting is missing or invalid', () => {
    expect(isPgaReportDateLocked('2020-01-01', null, now)).toBe(false)
    expect(isPgaReportDateLocked('2020-01-01', undefined, now)).toBe(false)
    expect(isPgaReportDateLocked('2020-01-01', Number.NaN, now)).toBe(false)
    expect(isPgaReportDateLocked('2020-01-01', -1, now)).toBe(false)
  })

  it('ignores malformed dates', () => {
    expect(isPgaReportDateLocked('', 14, now)).toBe(false)
    expect(isPgaReportDateLocked('not-a-date', 14, now)).toBe(false)
  })
})

describe('pgaLockMessage', () => {
  it('explains the window', () => {
    expect(pgaLockMessage(14)).toBe(
      'Reports lock 14 days after the report date. Contact an admin for corrections.'
    )
    expect(pgaLockMessage(1)).toContain('1 day after')
  })
})

describe('groupMissingEntries', () => {
  it('groups by region then FOB, sorted by name', () => {
    const groups = groupMissingEntries([
      { location_id: '1', location_name: 'Zeta', fob_id: 'f1', fob_name: 'Kampala', region_id: 'r1', region_name: 'Central' },
      { location_id: '2', location_name: 'Alpha', fob_id: 'f1', fob_name: 'Kampala', region_id: 'r1', region_name: 'Central' },
      { location_id: '3', location_name: 'Mid', fob_id: 'f2', fob_name: 'Entebbe', region_id: 'r1', region_name: 'Central' },
      { location_id: '4', location_name: 'West1', fob_id: 'f3', fob_name: 'Mbarara', region_id: 'r2', region_name: 'Western' },
      { location_id: '5', location_name: 'Orphan', fob_id: null, fob_name: null, region_id: null, region_name: null },
    ])
    expect(groups.map((g) => [g.name, g.count])).toEqual([
      ['Central', 3],
      ['No region', 1],
      ['Western', 1],
    ])
    expect(groups[0].fobs).toEqual([
      { name: 'Entebbe', locations: ['Mid'] },
      { name: 'Kampala', locations: ['Alpha', 'Zeta'] },
    ])
  })
})
