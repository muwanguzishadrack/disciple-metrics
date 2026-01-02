import Link from 'next/link'
import { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { SignupForm } from '@/components/auth/signup-form'
import { ROUTES, APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Sign Up | ${APP_NAME}`,
  description: 'Create a new account',
}

export default function SignupPage() {
  return (
    <AuthCard
      title="Create an account"
      description="Enter your details to get started"
      footer={
        <>
          Already have an account?{' '}
          <Link
            href={ROUTES.LOGIN}
            className="font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  )
}
