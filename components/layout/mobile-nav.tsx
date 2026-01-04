'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, LayoutDashboard, Users, MapPin, FileText, Settings, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { type RoleName } from '@/hooks/use-user'

type MobileLink = {
  title: string
  href: string
  icon: LucideIcon
  roles?: RoleName[] // If undefined, visible to all roles
}

const mobileLinks: MobileLink[] = [
  {
    title: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: LayoutDashboard,
  },
  {
    title: 'Reports',
    href: ROUTES.REPORTS,
    icon: FileText,
  },
  {
    title: 'Locations',
    href: ROUTES.LOCATIONS,
    icon: MapPin,
    roles: ['admin', 'fob_leader'],
  },
  {
    title: 'Team',
    href: ROUTES.TEAM,
    icon: Users,
    roles: ['admin'],
  },
  {
    title: 'Settings',
    href: ROUTES.SETTINGS,
    icon: Settings,
  },
]

interface MobileNavProps {
  userRole?: RoleName
}

export function MobileNav({ userRole }: MobileNavProps) {
  const pathname = usePathname()
  const { isOpen, toggle, close } = useSidebarStore()

  // Filter nav links based on user role
  const filteredLinks = mobileLinks.filter((link) => {
    if (!link.roles) return true // Visible to all if no roles specified
    if (!userRole) return false // Hide role-restricted links while loading
    return link.roles.includes(userRole)
  })

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground md:hidden"
        onClick={toggle}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
              onClick={close}
            />
            <motion.nav
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 20 }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-card md:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b px-4">
                <span className="text-lg font-semibold">{APP_NAME}</span>
                <Button variant="ghost" size="icon" onClick={close}>
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close menu</span>
                </Button>
              </div>

              <div className="space-y-1 p-2">
                {filteredLinks.map((link) => {
                  const isActive =
                    pathname === link.href ||
                    pathname.startsWith(`${link.href}/`)
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={close}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      )}
                    >
                      <link.icon className="h-5 w-5" />
                      {link.title}
                    </Link>
                  )
                })}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
