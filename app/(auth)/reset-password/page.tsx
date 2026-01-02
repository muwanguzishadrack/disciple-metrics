import { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Reset Password | ${APP_NAME}`,
  description: 'Create a new password',
}

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Reset password"
      description="Enter your new password below"
    >
      <ResetPasswordForm />
    </AuthCard>
  )
}
