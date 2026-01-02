'use client'

import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useThemeStore } from '@/stores/use-theme-store'
import { useUpdateProfile } from '@/hooks/use-user'
import { useToast } from '@/hooks/use-toast'
import { Theme } from '@/types'
import { cn } from '@/lib/utils'

const themes: { value: Theme; label: string; description: string; icon: typeof Sun }[] = [
  {
    value: 'light',
    label: 'Light',
    description: 'A bright theme for daytime use',
    icon: Sun,
  },
  {
    value: 'dark',
    label: 'Dark',
    description: 'Easy on the eyes for nighttime',
    icon: Moon,
  },
  {
    value: 'system',
    label: 'System',
    description: 'Follows your device settings',
    icon: Monitor,
  },
]

export function AppearanceForm() {
  const { theme, setTheme } = useThemeStore()
  const updateProfile = useUpdateProfile()
  const { toast } = useToast()

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme)
    try {
      await updateProfile.mutateAsync({ theme: newTheme })
      toast({
        title: 'Theme updated',
        description: `Theme changed to ${newTheme}`,
      })
    } catch {
      // Theme is already applied locally, just log the error
      console.error('Failed to save theme preference to server')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Theme</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select a theme for the application
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {themes.map((item) => (
          <Card
            key={item.value}
            className={cn(
              'cursor-pointer transition-all hover:border-primary',
              theme === item.value && 'border-primary ring-1 ring-primary'
            )}
            onClick={() => handleThemeChange(item.value)}
          >
            <CardContent className="pt-6 relative">
              {theme === item.value && (
                <div className="absolute top-2 right-2">
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              )}
              <item.icon
                className={cn(
                  'h-8 w-8 mb-3',
                  theme === item.value ? 'text-primary' : 'text-muted-foreground'
                )}
              />
              <h4 className="font-medium mb-1">{item.label}</h4>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="font-medium mb-2">Preview</h4>
        <div className="flex gap-4">
          <div className="flex-1 rounded-md bg-background border p-4">
            <div className="h-2 w-16 bg-foreground/20 rounded mb-2" />
            <div className="h-2 w-24 bg-foreground/10 rounded mb-2" />
            <div className="h-2 w-20 bg-foreground/10 rounded" />
          </div>
          <div className="flex-1 rounded-md bg-card border p-4">
            <div className="h-2 w-16 bg-primary/50 rounded mb-2" />
            <div className="h-2 w-24 bg-muted rounded mb-2" />
            <div className="h-2 w-20 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}
