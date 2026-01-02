'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Lock, Shield, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/constants'

const settingsLinks = [
  {
    title: 'Profile',
    href: ROUTES.SETTINGS_PROFILE,
    icon: User,
    description: 'Manage your profile information',
  },
  {
    title: 'Password',
    href: ROUTES.SETTINGS_PASSWORD,
    icon: Lock,
    description: 'Update your password',
  },
  {
    title: 'Two-Factor Auth',
    href: ROUTES.SETTINGS_TWO_FACTOR,
    icon: Shield,
    description: 'Add extra security to your account',
  },
  {
    title: 'Appearance',
    href: ROUTES.SETTINGS_APPEARANCE,
    icon: Palette,
    description: 'Customize the look and feel',
  },
]

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1">
      {settingsLinks.map((link) => {
        const isActive = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <link.icon className="h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{link.title}</span>
              <span
                className={cn(
                  'text-xs hidden md:block',
                  isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}
              >
                {link.description}
              </span>
            </div>
          </Link>
        )
      })}
    </nav>
  )
}
