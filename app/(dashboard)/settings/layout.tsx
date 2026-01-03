import { type ReactNode } from 'react'
import { Metadata } from 'next'
import { SettingsNav } from '@/components/settings/settings-nav'
import { PageHeader } from '@/components/layout/page-header'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Settings | ${APP_NAME}`,
  description: 'Manage your account settings',
}

interface SettingsLayoutProps {
  children: ReactNode
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences."
      />
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="flex flex-col gap-6 md:flex-row">
          <aside className="md:w-64 shrink-0">
            <SettingsNav />
          </aside>
          <div className="flex-1 max-w-2xl">{children}</div>
        </div>
      </div>
    </>
  )
}
