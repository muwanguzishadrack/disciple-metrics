import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildExportWorkbook, type ExportColumn } from '@/lib/export'

interface Row {
  location: string
  fob: string
  sv1: number
  hc1: number
  notes: string | null
}

const rows: Row[] = [
  { location: 'Kampala Central', fob: 'Central', sv1: 120, hc1: 4, notes: null },
  { location: 'Entebbe', fob: 'South', sv1: 75, hc1: 0, notes: 'late' },
]

const columns: ExportColumn<Row>[] = [
  { header: 'Location', accessor: 'location' },
  { header: 'FOB', accessor: 'fob', skipTotal: true },
  { header: 'SV1', accessor: 'sv1' },
  { header: 'HC1 x2', accessor: (r) => r.hc1 * 2 },
  { header: 'Notes', accessor: 'notes', skipTotal: true },
]

/** Write to .xlsx bytes and parse them back, as a user's spreadsheet app would. */
function roundTrip(wb: XLSX.WorkBook) {
  const bytes = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return XLSX.read(bytes, { type: 'buffer' })
}

describe('buildExportWorkbook', () => {
  it('writes headers, rows and a totals row that survive an xlsx round trip', () => {
    const wb = roundTrip(
      buildExportWorkbook(XLSX, { data: rows, columns, sheetName: 'PGA Report', includeTotals: true })
    )
    expect(wb.SheetNames).toEqual(['PGA Report'])
    const sheet = wb.Sheets['PGA Report']
    expect(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })).toEqual([
      ['Location', 'FOB', 'SV1', 'HC1 x2', 'Notes'],
      // A missing value is written as an empty text cell, as before.
      ['Kampala Central', 'Central', 120, 8, ''],
      ['Entebbe', 'South', 75, 0, 'late'],
      ['Total', '', 195, 8, ''],
    ])
    // Numbers stay numbers (not text) so totals and sums work in Excel.
    expect(sheet['C2'].t).toBe('n')
    expect(sheet['C4'].v).toBe(195)
  })

  it('omits the totals row unless asked and defaults the sheet name', () => {
    const wb = roundTrip(buildExportWorkbook(XLSX, { data: rows, columns }))
    expect(wb.SheetNames).toEqual(['Sheet1'])
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets.Sheet1, { header: 1 })
    expect(aoa).toHaveLength(3)
  })

  it('sizes columns from the longest value, capped at 50', () => {
    const long = [{ ...rows[0], location: 'x'.repeat(80) }]
    const wb = buildExportWorkbook(XLSX, { data: long, columns })
    expect(wb.Sheets.Sheet1['!cols']).toEqual([
      { wch: 50 },
      { wch: 9 },
      { wch: 5 },
      { wch: 8 },
      { wch: 7 },
    ])
  })
})
