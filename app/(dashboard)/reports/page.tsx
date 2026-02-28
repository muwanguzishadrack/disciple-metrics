'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUserRole } from '@/hooks/use-user'
import { PgaReportsTab } from '@/components/reports/pga-reports-tab'
import { FourWeekPgaTab } from '@/components/reports/four-week-pga-tab'
import { EpgaReportTab } from '@/components/reports/epga-report-tab'
import { FourWeekEpgaTab } from '@/components/reports/four-week-epga-tab'

export default function ReportsPage() {
  const { data: userRole } = useUserRole()
  const isAdmin = userRole === 'admin'
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null)

  if (!isAdmin) {
    return <PgaReportsTab />
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="View and manage PGA attendance reports"
      />
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <Tabs defaultValue="pga-reports">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full overflow-x-auto sm:w-auto">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="pga-reports" className="flex-1 sm:flex-initial">PGA</TabsTrigger>
                <TabsTrigger value="four-week-pga" className="flex-1 sm:flex-initial">4 Wk PGA</TabsTrigger>
                <TabsTrigger value="epga-report" className="flex-1 sm:flex-initial">EPGA</TabsTrigger>
                <TabsTrigger value="four-week-epga" className="flex-1 sm:flex-initial">4 Wk EPGA</TabsTrigger>
              </TabsList>
            </div>
            <div ref={setActionsContainer} className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:w-full [&>*]:sm:w-auto" />
          </div>
          <TabsContent value="pga-reports">
            <PgaReportsTab embedded actionsContainer={actionsContainer} />
          </TabsContent>
          <TabsContent value="four-week-pga">
            <FourWeekPgaTab actionsContainer={actionsContainer} />
          </TabsContent>
          <TabsContent value="epga-report">
            <EpgaReportTab actionsContainer={actionsContainer} />
          </TabsContent>
          <TabsContent value="four-week-epga">
            <FourWeekEpgaTab actionsContainer={actionsContainer} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
