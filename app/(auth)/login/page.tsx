import Link from 'next/link'
import { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { ROUTES, APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Sign In | ${APP_NAME}`,
  description: 'Sign in to your account',
}

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Enter your credentials to sign in to your account"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            href={ROUTES.SIGNUP}
            className="font-medium text-primary hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  )
}
