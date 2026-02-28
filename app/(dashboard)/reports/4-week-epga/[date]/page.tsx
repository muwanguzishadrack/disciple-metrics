'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Clock, Sparkles, TrendingUp, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useFourWeekEpgaDetail, type FourWeekRow } from '@/hooks/use-pga'
import { exportToExcel } from '@/lib/export'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'dd-MMM-yyyy')
}

export default function FourWeekEpgaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reportDate = params.date as string
  const { data, dates, metricAverages, isLoading } = useFourWeekEpgaDetail(reportDate)

  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const totalRows = data.length
  const totalPages = Math.ceil(totalRows / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedData = data.slice(startIndex, endIndex)

  const goToFirstPage = () => setCurrentPage(1)
  const goToLastPage = () => setCurrentPage(totalPages)
  const goToPreviousPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1))
  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages))

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value))
    setCurrentPage(1)
  }

  const handleExport = () => {
    const columns = [
      { header: 'Location', accessor: 'location' as keyof FourWeekRow, skipTotal: true },
      ...dates.map((date, i) => ({
        header: formatDate(date),
        accessor: ((row: FourWeekRow) => row.weekTotals[i] ?? '-') as (row: FourWeekRow) => string | number,
      })),
      { header: 'Average', accessor: 'average' as keyof FourWeekRow },
    ]

    exportToExcel<FourWeekRow>({
      data,
      columns,
      sheetName: '4 Week EPGA Average',
      fileName: `4_week_epga_average_${reportDate}`,
      includeTotals: true,
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  if (!metricAverages) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Report not found for {reportDate}</p>
      </div>
    )
  }

  const formattedDate = new Date(reportDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const stats = [
    { title: '1SV Avg', value: metricAverages.sv1, icon: Clock },
    { title: '2SV Avg', value: metricAverages.sv2, icon: Clock },
    { title: 'YXP Avg', value: metricAverages.yxp, icon: Sparkles },
    { title: 'Total Avg', value: metricAverages.total, icon: TrendingUp },
  ]

  return (
    <div>
      <PageHeader
        title={formattedDate}
        description="4 Week EPGA Average Details"
        actions={
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="border-[hsl(var(--header-fg)/0.3)] bg-[hsl(var(--header-fg)/0.1)] text-[hsl(var(--header-fg))] hover:bg-[hsl(var(--header-fg)/0.2)] hover:text-[hsl(var(--header-fg))]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
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
                    <stat.icon className="h-5 w-5 text-[#008cff] stroke-[1.5]" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <Card className="rounded-lg">
          <CardContent className="pt-6">
            <div className="flex justify-end mb-4">
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={data.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  {dates.map((date) => (
                    <TableHead key={date}>{formatDate(date)}</TableHead>
                  ))}
                  <TableHead>Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length > 0 ? (
                  paginatedData.map((row) => (
                    <TableRow key={row.locationId}>
                      <TableCell className="whitespace-nowrap">{row.location}</TableCell>
                      {row.weekTotals.map((total, i) => (
                        <TableCell key={i}>{total !== null ? total : '-'}</TableCell>
                      ))}
                      <TableCell className="font-semibold">{row.average}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={dates.length + 2} className="text-center text-muted-foreground py-8">
                      No location data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

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
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToFirstPage} disabled={currentPage === 1 || totalRows === 0}>
                  <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousPage} disabled={currentPage === 1 || totalRows === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextPage} disabled={currentPage === totalPages || totalRows === 0}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToLastPage} disabled={currentPage === totalPages || totalRows === 0}>
                  <ChevronLast className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
