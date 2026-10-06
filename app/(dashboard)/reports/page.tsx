'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReportsNav } from '@/components/reports/reports-nav'
import { PgaReportsTab } from '@/components/reports/pga-reports-tab'
import { FourWeekPgaTab } from '@/components/reports/four-week-pga-tab'
import { EpgaReportTab } from '@/components/reports/epga-report-tab'
import { FourWeekEpgaTab } from '@/components/reports/four-week-epga-tab'
import { SalvationReportTab } from '@/components/reports/salvation-report-tab'
import { MechanicsReportTab } from '@/components/reports/mechanics-report-tab'

// Every role gets every listing tab. All of them read security_invoker views /
// SECURITY INVOKER RPCs over pga_entries, whose RLS (can_access_location) already
// limits pastors to their location and FOB leaders to their FOB -- the same rows
// the PGA tab has always shown them. Destructive actions inside the tabs stay
// admin-only (each tab checks the role itself).
export default function ReportsPage() {
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null)

  return (
    <div>
      <PageHeader
        title="Reports"
        description="View and manage PGA attendance reports"
        actions={<ReportsNav />}
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
                <TabsTrigger value="salvation-report" className="flex-1 sm:flex-initial">Salvation</TabsTrigger>
                <TabsTrigger value="mechanics-report" className="flex-1 sm:flex-initial">Mechanics</TabsTrigger>
              </TabsList>
            </div>
            <div ref={setActionsContainer} className="flex w-full flex-wrap items-center gap-2 sm:w-auto *:w-full sm:*:w-auto" />
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
          <TabsContent value="salvation-report">
            <SalvationReportTab actionsContainer={actionsContainer} />
          </TabsContent>
          <TabsContent value="mechanics-report">
            <MechanicsReportTab actionsContainer={actionsContainer} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
