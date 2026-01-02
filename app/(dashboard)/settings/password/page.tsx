import { Metadata } from 'next'
import { PasswordForm } from '@/components/settings/password-form'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Password Settings | ${APP_NAME}`,
  description: 'Change your password',
}

export default function PasswordSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Password</h2>
        <p className="text-sm text-muted-foreground">
          Change your password to keep your account secure.
        </p>
      </div>
      <PasswordForm />
    </div>
  )
}
