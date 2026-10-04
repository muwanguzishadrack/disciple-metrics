'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusCard } from '@/components/analytics/status-card'
import { useUserRole } from '@/hooks/use-user'
import { ROUTES } from '@/lib/constants'
import { ChangeLogTab } from './change-log-tab'
import { DeletedTab } from './deleted-tab'

export function ActivityView() {
  const router = useRouter()
  const { data: userRole, isLoading } = useUserRole()
  const isAdmin = userRole === 'admin'
  const roleKnown = !isLoading && userRole !== undefined

  // Non-admins are sent back to the dashboard; the RPCs also refuse them.
  useEffect(() => {
    if (roleKnown && !isAdmin) router.replace(ROUTES.DASHBOARD)
  }, [roleKnown, isAdmin, router])

  return (
    <div>
      <PageHeader title="Activity" description="Who changed what in PGA reports, and restore deleted data" />
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        {!roleKnown ? (
          <Card className="rounded-lg">
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        ) : !isAdmin ? (
          <StatusCard
            variant="error"
            title="Admins only"
            description="Activity is only available to admins. Taking you back to the dashboard…"
          />
        ) : (
          <Tabs defaultValue="changes">
            <TabsList className="mb-4">
              <TabsTrigger value="changes">Changes</TabsTrigger>
              <TabsTrigger value="deleted">Deleted</TabsTrigger>
            </TabsList>
            <TabsContent value="changes">
              <ChangeLogTab />
            </TabsContent>
            <TabsContent value="deleted">
              <DeletedTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
