'use client'

import { useEffect } from 'react'
import { OverlayScrollbars } from 'overlayscrollbars'
import 'overlayscrollbars/overlayscrollbars.css'

export function ScrollbarProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize on the body element for browser-level scrolling
    const osInstance = OverlayScrollbars(document.body, {
      scrollbars: {
        theme: 'os-theme-dark',
        autoHide: 'scroll',
        autoHideDelay: 400,
      },
    })

    return () => osInstance?.destroy()
  }, [])

  return <>{children}</>
}
