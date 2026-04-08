import React from 'react'

export default class PageErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('[PageErrorBoundary]', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1012' }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
            This page crashed unexpectedly. Your data is safe.
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 14px', maxWidth: 400, overflowX: 'auto', fontFamily: 'monospace' }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#C9697A', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0,...(this.props.style||{})}}>{this.props.children}</div>
  }
}
