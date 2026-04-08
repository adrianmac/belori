import React from 'react'
import { C } from '../lib/colors'
import { usePushNotifications } from '../hooks/usePushNotifications'

export default function PushNotificationToggle() {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()

  if (!supported) return (
    <div style={{ fontSize: 12, color: C.gray, padding: '8px 0' }}>
      Push notifications are not supported in this browser.
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>Browser push notifications</div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
          {subscribed
            ? 'You\'ll get alerts for overdue payments, upcoming appointments, and signed contracts.'
            : 'Get alerts for overdue payments, upcoming appointments, and signed contracts — even when the app isn\'t open.'}
        </div>
      </div>
      <button
        onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        style={{
          flexShrink: 0,
          marginLeft: 16,
          padding: '8px 16px',
          borderRadius: 9,
          border: subscribed ? `1px solid ${C.border}` : 'none',
          background: loading ? C.grayBg : subscribed ? C.white : C.rosa,
          color: loading ? C.gray : subscribed ? C.gray : C.white,
          fontSize: 12,
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
      >
        {loading ? '…' : subscribed ? '🔔 Enabled — Click to disable' : '🔔 Enable notifications'}
      </button>
    </div>
  )
}
