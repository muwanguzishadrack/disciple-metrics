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

        {/* Copyright & Developer Credit */}
        <div className="absolute bottom-6 left-6 z-10 text-sm text-white/70">
          <p>&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <p>
            Developed by{' '}
            <a
              href="https://luminouscrm.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Luminous Technologies
            </a>
            .
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-card p-6 sm:p-8">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
        <div className="text-xs text-muted-foreground lg:hidden">
          <p>&copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.</p>
          <p>
            Developed by{' '}
            <a
              href="https://luminouscrm.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Luminous Technologies
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
