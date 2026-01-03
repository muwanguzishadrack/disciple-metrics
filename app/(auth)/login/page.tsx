import { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Sign In | ${APP_NAME}`,
  description: 'Sign in to your account',
}

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Enter your credentials to sign in to your account"
    >
      <LoginForm />
    </AuthCard>
  )
}
