'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ReportsNav } from '@/components/reports/reports-nav'
import { PgaReportsTab } from '@/components/reports/pga-reports-tab'
import { FourWeekPgaTab } from '@/components/reports/four-week-pga-tab'
import { EpgaReportTab } from '@/components/reports/epga-report-tab'
import { FourWeekEpgaTab } from '@/components/reports/four-week-epga-tab'
import { SalvationReportTab } from '@/components/reports/salvation-report-tab'
import { BaptismsReportTab } from '@/components/reports/baptisms-report-tab'
import { MechanicsReportTab } from '@/components/reports/mechanics-report-tab'

// Seven tabs don't fit on one line below lg. Phones get a dropdown instead of
// the tab list; from md up the list is one row of seven equal cells, and from
// lg up it is the usual inline tab strip.
const REPORT_TABS = [
  { value: 'pga-reports', label: 'PGA' },
  { value: 'four-week-pga', label: '4 Wk PGA' },
  { value: 'epga-report', label: 'EPGA' },
  { value: 'four-week-epga', label: '4 Wk EPGA' },
  { value: 'salvation-report', label: 'Salvation' },
  { value: 'baptisms-report', label: 'Baptisms' },
  { value: 'mechanics-report', label: 'Mechanics' },
]

// Every role gets every listing tab. All of them read security_invoker views /
// SECURITY INVOKER RPCs over pga_entries, whose RLS (can_access_location) already
// limits pastors to their location and FOB leaders to their FOB -- the same rows
// the PGA tab has always shown them. Destructive actions inside the tabs stay
// admin-only (each tab checks the role itself).
export default function ReportsPage() {
  const [actionsContainer, setActionsContainer] = useState<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState(REPORT_TABS[0].value)

  return (
    <div>
      <PageHeader
        title="Reports"
        description="View and manage PGA attendance reports"
        actions={<ReportsNav />}
      />
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger aria-label="Report" className="w-full md:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TABS.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TabsList className="hidden w-full md:grid md:grid-cols-7 md:gap-1 lg:inline-flex lg:w-auto lg:gap-0">
              {REPORT_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="md:px-2 lg:px-4">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div ref={setActionsContainer} className="flex w-full flex-wrap items-center gap-2 sm:justify-end lg:w-auto *:w-full sm:*:w-auto" />
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
          <TabsContent value="baptisms-report">
            <BaptismsReportTab actionsContainer={actionsContainer} />
          </TabsContent>
          <TabsContent value="mechanics-report">
            <MechanicsReportTab actionsContainer={actionsContainer} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
