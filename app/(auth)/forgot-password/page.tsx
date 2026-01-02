'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { ROUTES } from '@/lib/constants'

export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false)

  return (
    <AuthCard
      title={isSuccess ? 'Check your email' : 'Forgot password?'}
      description={
        isSuccess
          ? "We've sent you password reset instructions"
          : "Enter your email and we'll send you a reset link"
      }
      footer={
        !isSuccess ? (
          <>
            Remember your password?{' '}
            <Link
              href={ROUTES.LOGIN}
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : null
      }
    >
      <ForgotPasswordForm onSuccess={() => setIsSuccess(true)} />
    </AuthCard>
  )
}
