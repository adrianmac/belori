import { useState, useEffect } from 'react'

export default function OfflineIndicator() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1F2937', color: '#F9FAFB', textAlign: 'center',
      padding: '8px 16px', fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <span>📡</span>
      <span>You're offline — showing cached data</span>
    </div>
  )
}
