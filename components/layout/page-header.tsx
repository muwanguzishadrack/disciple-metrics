'use client'

import { type ReactNode } from 'react'

interface PageHeaderProps {
  title: ReactNode
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="bg-[hsl(var(--header-bg))] py-6">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-[hsl(var(--header-fg))]">
              {title}
            </h1>
            {description && (
              <p className="text-[hsl(var(--header-fg)/0.7)]">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
