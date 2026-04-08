import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const STORAGE_KEY = 'belori_layout_mode'

// ─── Device Detection ──────────────────────────────────────────────────────
function getRecommendedMode() {
  if (typeof window === 'undefined') return 'desktop'

  const ua = navigator.userAgent.toLowerCase()
  const isIPad = /ipad/.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/.test(ua))
  const isAndroidTablet = /android/.test(ua) && !/mobile/.test(ua)
  const isSurface = navigator.maxTouchPoints > 1 && window.innerWidth >= 768
  const isTouchScreen = navigator.maxTouchPoints > 0 && window.innerWidth < 1200

  return (isIPad || isAndroidTablet || isSurface || isTouchScreen) ? 'tablet' : 'desktop'
}

function getInitialMode() {
  if (typeof window === 'undefined') return 'desktop'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'desktop' || saved === 'tablet') return saved
  return getRecommendedMode()
}

// ─── Context ───────────────────────────────────────────────────────────────
const LayoutModeContext = createContext({
  mode: 'desktop',
  isTablet: false,
  isDesktop: true,
  toggle: () => {},
  setMode: () => {},
})

export function LayoutModeProvider({ children }) {
  const [mode, setModeState] = useState(getInitialMode)

  const applyMode = useCallback((m) => {
    document.documentElement.setAttribute('data-mode', m)
  }, [])

  const setMode = useCallback((m) => {
    setModeState(m)
    localStorage.setItem(STORAGE_KEY, m)
    applyMode(m)
  }, [applyMode])

  const toggle = useCallback(() => {
    setMode(mode === 'desktop' ? 'tablet' : 'desktop')
  }, [mode, setMode])

  // Apply on mount
  useEffect(() => {
    applyMode(mode)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LayoutModeContext.Provider value={{
      mode,
      isTablet: mode === 'tablet',
      isDesktop: mode === 'desktop',
      toggle,
      setMode,
    }}>
      {children}
    </LayoutModeContext.Provider>
  )
}

export const useLayoutMode = () => useContext(LayoutModeContext)
