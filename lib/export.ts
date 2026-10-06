// SheetJS is loaded on demand (see exportToExcel) so it is not part of any
// page's first-load JS. Only its types are imported statically.
import type * as XLSXModule from 'xlsx'

type XLSXLib = Pick<typeof XLSXModule, 'utils'>

export interface ExportColumn<T> {
  header: string
  accessor: keyof T | string | ((row: T) => string | number)
  skipTotal?: boolean  // If true, show empty cell in totals row
}

export interface ExportOptions<T> {
  data: T[]
  columns: ExportColumn<T>[]
  sheetName?: string
  fileName: string
  includeTotals?: boolean
}

/**
 * Builds the workbook for an export. Pure, so it can be unit tested.
 */
export function buildExportWorkbook<T extends object>(
  XLSX: XLSXLib,
  {
    data,
    columns,
    sheetName = 'Sheet1',
    includeTotals = false,
  }: Omit<ExportOptions<T>, 'fileName'>
): XLSXModule.WorkBook {
  // Transform data to array of arrays with headers
  const headers = columns.map((col) => col.header)

  const rows = data.map((row) =>
    columns.map((col) => {
      if (typeof col.accessor === 'function') {
        return col.accessor(row)
      }
      const value = (row as Record<string, unknown>)[col.accessor as string]
      return value ?? ''
    })
  )

  // Calculate totals row if requested
  let totalsRow: (string | number)[] = []
  if (includeTotals && rows.length > 0) {
    totalsRow = columns.map((col, colIndex) => {
      if (colIndex === 0) {
        return 'Total'
      }
      if (col.skipTotal) {
        return ''  // Empty cell for columns that should skip totals
      }
      // Sum numeric values in this column
      const sum = rows.reduce((acc, row) => {
        const val = row[colIndex]
        if (typeof val === 'number') {
          return acc + val
        }
        return acc
      }, 0)
      return sum
    })
  }

  // Create worksheet with headers + data rows + optional totals
  const worksheetData = includeTotals && totalsRow.length > 0
    ? [headers, ...rows, totalsRow]
    : [headers, ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  // Auto-size columns based on content
  const columnWidths = columns.map((_, colIndex) => {
    const maxLength = Math.max(
      headers[colIndex].length,
      ...rows.map((row) => String(row[colIndex]).length)
    )
    return { wch: Math.min(maxLength + 2, 50) }
  })
  worksheet['!cols'] = columnWidths

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  return workbook
}

/**
 * Exports data to an Excel file and triggers download. SheetJS is downloaded
 * the first time a user exports, not with the page.
 */
export async function exportToExcel<T extends object>({
  fileName,
  ...options
}: ExportOptions<T>): Promise<void> {
  const XLSX = await import('xlsx')
  const workbook = buildExportWorkbook(XLSX, options)

  // Generate filename with date
  const date = new Date().toISOString().split('T')[0]
  const fullFileName = `${fileName}_${date}.xlsx`

  // Trigger download
  XLSX.writeFile(workbook, fullFileName)
}
