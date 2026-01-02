import { Metadata } from 'next'
import { TwoFactorAuthForm } from '@/components/settings/two-factor-auth-form'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Two-Factor Authentication | ${APP_NAME}`,
  description: 'Enable two-factor authentication for your account',
}

export default function TwoFactorAuthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Two-Factor Authentication</h2>
        <p className="text-sm text-muted-foreground">
          Add an extra layer of security to your account.
        </p>
      </div>
      <TwoFactorAuthForm />
    </div>
  )
}
