'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSidebarStore } from '@/stores/use-sidebar-store'
import { ROUTES, APP_NAME } from '@/lib/constants'
import { type RoleName } from '@/hooks/use-user'

type MobileLink = {
  title: string
  href: string
  roles?: RoleName[] // If undefined, visible to all roles
}

const mobileLinks: MobileLink[] = [
  { title: 'Dashboard', href: ROUTES.DASHBOARD },
  { title: 'Reports', href: ROUTES.REPORTS },
  { title: 'Locations', href: ROUTES.LOCATIONS, roles: ['admin', 'fob_leader'] },
  { title: 'Team', href: ROUTES.TEAM, roles: ['admin'] },
  { title: 'Settings', href: ROUTES.SETTINGS },
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
        className="!h-12 !w-12 !p-0 text-[hsl(var(--header-fg))] hover:bg-[hsl(var(--header-fg)/0.1)] hover:text-[hsl(var(--header-fg))] md:hidden"
        onClick={toggle}
      >
        <Menu style={{ width: 32, height: 32 }} />
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
              className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col border-r bg-card dark:bg-[hsl(224,50%,10%)] dark:border-[hsl(224,50%,18%)] md:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b dark:border-[hsl(224,50%,18%)] px-4">
                <div className="relative">
                  <Image
                    src="/images/Disciple Metrics Logo 02.svg"
                    alt="Disciple Metrics"
                    width={180}
                    height={45}
                    style={{ height: 'auto' }}
                    className="dark:hidden"
                  />
                  <Image
                    src="/images/Disciple Metrics Logo 01.svg"
                    alt="Disciple Metrics"
                    width={180}
                    height={45}
                    style={{ height: 'auto' }}
                    className="hidden dark:block"
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={close} className="dark:hover:bg-[hsl(224,50%,15%)]">
                  <X className="h-5 w-5" />
                  <span className="sr-only">Close menu</span>
                </Button>
              </div>

              <div className="flex-1 space-y-2 p-3">
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
                        'block rounded-lg px-4 py-3 text-base font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground dark:bg-[hsl(213,94%,68%)] dark:text-[hsl(224,71%,3%)]'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-[hsl(224,50%,15%)]'
                      )}
                    >
                      {link.title}
                    </Link>
                  )
                })}
              </div>

              <p className="p-4 text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
              </p>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
