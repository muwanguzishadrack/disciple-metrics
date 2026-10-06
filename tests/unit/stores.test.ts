import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('theme store persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('reads a theme saved by the previous app version', async () => {
    // Exactly what zustand 4's persist wrote under the same key.
    localStorage.setItem('theme-storage', JSON.stringify({ state: { theme: 'dark' }, version: 0 }))
    const { useThemeStore } = await import('@/stores/use-theme-store')
    await useThemeStore.persist.rehydrate()
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('saves under the same key and shape', async () => {
    const { useThemeStore } = await import('@/stores/use-theme-store')
    useThemeStore.getState().setTheme('system')
    expect(JSON.parse(localStorage.getItem('theme-storage')!)).toEqual({
      state: { theme: 'system' },
      version: 0,
    })
  })
})

describe('sidebar store', () => {
  it('toggles, opens and closes', async () => {
    const { useSidebarStore } = await import('@/stores/use-sidebar-store')
    const s = useSidebarStore.getState
    expect(s().isOpen).toBe(false)
    s().toggle()
    expect(s().isOpen).toBe(true)
    s().close()
    expect(s().isOpen).toBe(false)
    s().open()
    expect(s().isOpen).toBe(true)
  })
})
