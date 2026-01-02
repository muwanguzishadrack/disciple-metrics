'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthCard } from '@/components/auth/auth-card'
import { useResendVerificationEmail } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { ROUTES } from '@/lib/constants'

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('')
  const [resent, setResent] = useState(false)
  const { toast } = useToast()
  const resendEmail = useResendVerificationEmail()

  const handleResend = async () => {
    if (!email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter your email address',
      })
      return
    }

    try {
      await resendEmail.mutateAsync(email)
      setResent(true)
      toast({
        title: 'Email sent!',
        description: 'A new verification email has been sent.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to resend email',
      })
    }
  }

  return (
    <AuthCard
      title="Check your email"
      description="We've sent you a verification link"
      footer={
        <>
          Already verified?{' '}
          <Link
            href={ROUTES.LOGIN}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-4"
      >
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Click the link in the email we sent you to verify your account. If you
          don&apos;t see it, check your spam folder.
        </p>

        <div className="space-y-4">
          <p className="text-sm font-medium">Didn&apos;t receive the email?</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              onClick={handleResend}
              disabled={resendEmail.isPending || resent}
              variant={resent ? 'outline' : 'default'}
            >
              {resendEmail.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : resent ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Sent
                </>
              ) : (
                'Resend'
              )}
            </Button>
          </div>
          {resent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setResent(false)}
              className="text-xs"
            >
              Send again
            </Button>
          )}
        </div>
      </motion.div>
    </AuthCard>
  )
}
