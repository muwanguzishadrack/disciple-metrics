import { type ReactNode } from 'react'
import { Header } from '@/components/layout/header'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="sticky top-0 z-50 bg-primary">
        <Header />
      </div>
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
