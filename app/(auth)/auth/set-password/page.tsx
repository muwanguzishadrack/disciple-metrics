import { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { SetPasswordForm } from '@/components/auth/set-password-form'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Set Password | ${APP_NAME}`,
  description: 'Create a password for your account',
}

export default function SetPasswordPage() {
  return (
    <AuthCard
      title="Welcome to the team!"
      description="Create a password to complete your account setup"
    >
      <SetPasswordForm />
    </AuthCard>
  )
}
