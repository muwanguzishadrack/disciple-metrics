import { Metadata } from 'next'
import { AppearanceForm } from '@/components/settings/appearance-form'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Appearance Settings | ${APP_NAME}`,
  description: 'Customize the look and feel of the application',
}

export default function AppearanceSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize how the application looks and feels.
        </p>
      </div>
      <AppearanceForm />
    </div>
  )
}
