import { type ReactNode } from 'react'
import { Metadata } from 'next'
import { SettingsNav } from '@/components/settings/settings-nav'
import { Separator } from '@/components/ui/separator'
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      <Separator />
      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="md:w-64 shrink-0">
          <SettingsNav />
        </aside>
        <div className="flex-1 max-w-2xl">{children}</div>
      </div>
    </div>
  )
}
