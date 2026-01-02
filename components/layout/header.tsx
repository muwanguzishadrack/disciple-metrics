'use client'

import { MobileNav } from './mobile-nav'
import { ThemeToggle } from './theme-toggle'
import { UserNav } from './user-nav'
import { APP_NAME } from '@/lib/constants'

export function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-4">
        <MobileNav />
        <span className="text-lg font-semibold md:hidden">{APP_NAME}</span>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserNav />
      </div>
    </header>
  )
}
