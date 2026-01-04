import { Metadata } from 'next'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { APP_NAME, ROUTES } from '@/lib/constants'

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
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href={ROUTES.SIGNUP} className="text-primary hover:underline">
          Create one
        </Link>
      </p>
    </AuthCard>
  )
}
