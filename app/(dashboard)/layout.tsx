import { type ReactNode } from 'react'
import { Header } from '@/components/layout/header'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="bg-primary">
        <Header />
      </div>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
