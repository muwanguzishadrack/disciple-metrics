import type { Metadata } from 'next'
import { DM_Sans, DM_Mono } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/components/providers/query-provider'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ToasterProvider } from '@/components/providers/toaster-provider'
import { SessionTimeoutProvider } from '@/components/providers/session-timeout-provider'
import { ScrollbarProvider } from '@/components/providers/scrollbar-provider'
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-dm-mono',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${dmMono.variable} font-sans antialiased`}
      >
        <QueryProvider>
          <ThemeProvider>
            <ScrollbarProvider>
              <SessionTimeoutProvider>
                {children}
              </SessionTimeoutProvider>
            </ScrollbarProvider>
            <ToasterProvider />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
