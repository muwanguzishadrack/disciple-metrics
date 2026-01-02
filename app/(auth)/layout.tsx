import { type ReactNode } from 'react'
import { APP_NAME } from '@/lib/constants'

interface AuthLayoutProps {
  children: ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden m-2.5 mr-0 rounded-2xl">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/images/auth-page-bg.jpg)' }}
        />

        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-primary/60" />

        {/* Copyright */}
        <p className="absolute bottom-6 left-6 z-10 text-sm text-white/70">
          &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-card p-6 sm:p-8">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
