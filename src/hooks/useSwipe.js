import { useRef, useCallback } from 'react'

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60 }) {
  const touchStart = useRef(null)

  const onTouchStart = useCallback(e => {
    touchStart.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback(e => {
    if (touchStart.current === null) return
    const delta = e.changedTouches[0].clientX - touchStart.current
    if (Math.abs(delta) >= threshold) {
      if (delta < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    }
    touchStart.current = null
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { onTouchStart, onTouchEnd }
}
