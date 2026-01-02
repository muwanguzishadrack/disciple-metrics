'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'

interface AuthCardProps {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      {/* Logo */}
      <div className="mb-8">
        <Image
          src="/images/Disciple Metrics Logo 02.svg"
          alt="Disciple Metrics"
          width={200}
          height={48}
          className="dark:hidden"
          priority
        />
        <Image
          src="/images/Disciple Metrics Logo 01.svg"
          alt="Disciple Metrics"
          width={200}
          height={48}
          className="hidden dark:block"
          priority
        />
      </div>

      <div>
        <div className="space-y-1 mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </motion.div>
  )
}
