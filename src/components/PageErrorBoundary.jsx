import React from 'react'

// ─── Per-page Error Boundary ────────────────────────────────────────────────
// Wraps each lazy-loaded screen. When a page crashes, only that page's viewport
// shows the fallback — the sidebar, topbar, and other open state stay intact.
// Visual: couture editorial fail state consistent with the global ErrorBoundary
// but scoped to the inner panel. Reset lets the user retry without a full refresh.
export default class PageErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('[PageErrorBoundary]', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0, padding: 40,
          background: '#F8F4F0',
          fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
          color: '#1C1118',
          overflow: 'auto',
        }}>
          {/* Top accent — muted red hairline */}
          <div aria-hidden="true" style={{
            height: 2, width: 40, background: '#A34454', opacity: 0.7,
            marginBottom: 28,
          }} />
          {/* Ornament */}
          <div aria-hidden="true" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 22, opacity: 0.75,
          }}>
            <span style={{ height: 1, width: 36, background: 'linear-gradient(90deg, transparent, #B08A4E)' }} />
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 0l5 5-5 5-5-5 5-5z" fill="#B08A4E" />
            </svg>
            <span style={{ height: 1, width: 36, background: 'linear-gradient(270deg, transparent, #B08A4E)' }} />
          </div>
          <h2 style={{
            fontFamily: "'Cormorant Garamond','Didot',Georgia,serif",
            fontSize: 26, fontStyle: 'italic', fontWeight: 400,
            color: '#1C1118', margin: 0, textAlign: 'center',
            letterSpacing: '0.005em',
          }}>
            A stitch has come loose on this page.
          </h2>
          <p style={{
            fontSize: 13, color: '#5C4A52',
            margin: '14px auto 0', lineHeight: 1.65,
            maxWidth: 380, textAlign: 'center',
          }}>
            Only this screen was affected — your other work is untouched.
            Try again, or use the sidebar to navigate elsewhere.
          </p>
          {this.state.error?.message && (
            <div style={{
              marginTop: 20,
              fontSize: 11, color: '#7A6670',
              background: '#FEFBF7', border: '1px solid #EDE7E2',
              padding: '10px 14px', maxWidth: 420,
              fontFamily: 'ui-monospace, Menlo, monospace',
              overflowX: 'auto', whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              textTransform: 'none', letterSpacing: 0,
            }}>
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-solid"
            data-color="primary"
            style={{ marginTop: 28 }}
          >
            Try again
          </button>
        </div>
      )
    }
    return <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0,...(this.props.style||{})}}>{this.props.children}</div>
  }
}
