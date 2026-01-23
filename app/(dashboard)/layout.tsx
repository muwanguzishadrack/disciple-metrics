import { type ReactNode } from 'react'
import { Header } from '@/components/layout/header'
import { APP_NAME } from '@/lib/constants'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 pt-16">{children}</main>
      <footer className="py-6">
        <div className="mx-auto max-w-7xl px-4 md:px-6 text-xs text-muted-foreground">
          <span>
            &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </span>
          <span className="hidden md:inline">{' · '}</span>
          <br className="md:hidden" />
          <span>
            Developed by{' '}
            <a
              href="https://luminouscrm.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Luminous Technologies
            </a>
            .
          </span>
        </div>
      </footer>
    </div>
  )
}
