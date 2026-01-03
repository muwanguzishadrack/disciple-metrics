'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { MobileNav } from './mobile-nav'
import { ThemeToggle } from './theme-toggle'
import { UserNav } from './user-nav'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'

const navLinks = [
  { title: 'Dashboard', href: ROUTES.DASHBOARD },
  { title: 'Reports', href: ROUTES.REPORTS },
  { title: 'Locations', href: ROUTES.LOCATIONS },
  { title: 'Team', href: ROUTES.TEAM },
  { title: 'Settings', href: ROUTES.SETTINGS },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-8">
          <MobileNav />
          <Image
            src="/images/Disciple Metrics Logo 01.svg"
            alt="Disciple Metrics"
            width={160}
            height={40}
            priority
          />
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-sm transition-colors',
                    isActive
                      ? 'font-medium text-primary-foreground'
                      : 'text-primary-foreground/70 hover:text-primary-foreground'
                  )}
                >
                  {link.title}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </header>
  )
}
