'use client'

import { Shield, Smartphone, Key, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function TwoFactorAuthForm() {
  const features = [
    {
      icon: Smartphone,
      title: 'Authenticator App',
      description: 'Use an app like Google Authenticator or Authy',
    },
    {
      icon: Key,
      title: 'Recovery Codes',
      description: 'Backup codes for account recovery',
    },
    {
      icon: Shield,
      title: 'Enhanced Security',
      description: 'Protect your account from unauthorized access',
    },
  ]

  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <Label htmlFor="2fa" className="text-base font-medium">
                  Two-Factor Authentication
                </Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
            </div>
            <Switch id="2fa" disabled />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-lg bg-muted p-4">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Coming soon!</span> Two-factor
          authentication will be available in a future update.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-medium">What you&apos;ll get</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-muted/50">
              <CardContent className="pt-6">
                <feature.icon className="h-8 w-8 text-muted-foreground mb-3" />
                <h4 className="font-medium mb-1">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
