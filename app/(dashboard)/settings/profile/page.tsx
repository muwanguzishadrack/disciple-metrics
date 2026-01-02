import { Metadata } from 'next'
import { ProfileForm } from '@/components/settings/profile-form'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Profile Settings | ${APP_NAME}`,
  description: 'Manage your profile information',
}

export default function ProfileSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Update your profile information.
        </p>
      </div>
      <ProfileForm />
    </div>
  )
}
