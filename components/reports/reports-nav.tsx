'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'

const links = [
  { title: 'Reports', href: ROUTES.REPORTS },
  { title: 'Trends', href: ROUTES.REPORTS_TRENDS },
  { title: 'Compare', href: ROUTES.REPORTS_COMPARE },
]

/** Switches between the report listings, Trends and Compare */
export function ReportsNav({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Report views"
      className={cn(
        'inline-flex items-center rounded-lg bg-[hsl(var(--header-fg)/0.1)] p-1',
        className
      )}
    >
      {links.map((link) => {
        const isActive = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-[hsl(var(--header-fg))] font-medium text-[hsl(var(--header-bg))]'
                : 'text-[hsl(var(--header-fg)/0.8)] hover:text-[hsl(var(--header-fg))]'
            )}
          >
            {link.title}
          </Link>
        )
      })}
    </nav>
  )
}
