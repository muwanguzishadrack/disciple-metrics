'use client'

import { type ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { describeRpcError, isMissingRpcError } from './rpc-errors'

interface StatusCardProps {
  title: string
  description?: ReactNode
  variant?: 'empty' | 'error'
}

export function StatusCard({ title, description, variant = 'empty' }: StatusCardProps) {
  const Icon = variant === 'error' ? AlertTriangle : Inbox
  return (
    <Card className="rounded-lg">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center" role={variant === 'error' ? 'alert' : 'status'}>
        <Icon
          className={variant === 'error' ? 'h-8 w-8 text-destructive' : 'h-8 w-8 text-muted-foreground'}
          aria-hidden="true"
        />
        <p className="font-medium">{title}</p>
        {description && (
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Friendly card for a failed RPC; "not deployed yet" reads as info, not an error */
export function RpcErrorCard({ error, feature }: { error: unknown; feature: string }) {
  const missing = isMissingRpcError(error)
  return (
    <StatusCard
      variant={missing ? 'empty' : 'error'}
      title={missing ? `${feature} is coming soon` : `Couldn't load ${feature.toLowerCase()}`}
      description={describeRpcError(error, feature)}
    />
  )
}
