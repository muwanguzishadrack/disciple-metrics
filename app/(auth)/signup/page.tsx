import { Metadata } from 'next'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/auth-card'
import { SignupForm } from '@/components/auth/signup-form'
import { APP_NAME, ROUTES } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Sign Up | ${APP_NAME}`,
  description: 'Create your account',
}

export default function SignupPage() {
  return (
    <AuthCard
      title="Create an account"
      description="Enter your details to get started"
    >
      <SignupForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href={ROUTES.LOGIN} className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}
