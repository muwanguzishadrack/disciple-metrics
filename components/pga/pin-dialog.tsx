'use client'

import { useState, useEffect } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import { cn } from '@/lib/utils'

interface PinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (pin: string) => void
  isLoading?: boolean
  error?: string | null
}

export function PinDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  error = null,
}: PinDialogProps) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  // Reset PIN when dialog opens/closes
  useEffect(() => {
    if (open) {
      setPin('')
    }
  }, [open])

  // Trigger shake animation on error
  useEffect(() => {
    if (error) {
      setShake(true)
      setPin('')
      const timer = setTimeout(() => setShake(false), 500)
      return () => clearTimeout(timer)
    }
  }, [error])

  const handleConfirm = () => {
    if (pin.length === 4) {
      onConfirm(pin)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4 && !isLoading) {
      handleConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-lg sm:max-w-[400px]" onKeyDown={handleKeyDown}>
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle>Enter Access Code</DialogTitle>
          <DialogDescription>
            Please enter the 4-digit access code to submit
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div
            className={cn(
              'transition-transform',
              shake && 'animate-shake'
            )}
          >
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={setPin}
              disabled={isLoading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="h-12 w-12 text-lg" />
                <InputOTPSlot index={1} className="h-12 w-12 text-lg" />
                <InputOTPSlot index={2} className="h-12 w-12 text-lg" />
                <InputOTPSlot index={3} className="h-12 w-12 text-lg" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter className="sm:justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pin.length !== 4 || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
