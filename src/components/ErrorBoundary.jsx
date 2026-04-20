import React from 'react'
import * as Sentry from '@sentry/react'
import { C } from '../lib/colors'
import { PrimaryBtn, GhostBtn } from '../lib/ui.jsx'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, eventId: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo })
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Report to Sentry with component stack context
    const eventId = Sentry.captureException(error, {
      contexts: {
        react: { componentStack: errorInfo?.componentStack },
      },
    })
    this.setState({ eventId })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh',
          background: '#F8F4F0', padding: 24, color: '#1C1118',
          fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
        }}>
          <div style={{
            background: '#FEFBF7',
            border: '1px solid #EDE7E2',
            borderRadius: 3,
            padding: '40px 44px 32px',
            boxShadow: '0 28px 80px -12px rgba(28,17,24,0.18), 0 1px 3px rgba(28,17,24,0.06)',
            maxWidth: 520, width: '100%', textAlign: 'center',
          }}>
            {/* Top accent — muted red hairline */}
            <div style={{
              height: 2, background: '#A34454', opacity: 0.7,
              width: 40, margin: '0 auto 28px',
            }}/>
            {/* Ornament */}
            <div aria-hidden="true" style={{
              display:'flex', alignItems:'center', justifyContent:'center',
              gap: 10, marginBottom: 22, opacity: 0.75,
            }}>
              <span style={{ height: 1, width: 40, background: 'linear-gradient(90deg, transparent, #B08A4E)' }} />
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 0l5 5-5 5-5-5 5-5z" fill="#B08A4E" />
              </svg>
              <span style={{ height: 1, width: 40, background: 'linear-gradient(270deg, transparent, #B08A4E)' }} />
            </div>
            <h1 style={{
              fontFamily: "'Cormorant Garamond','Didot',Georgia,serif",
              fontSize: 30, fontStyle:'italic', fontWeight:400,
              color: '#1C1118', margin: 0, letterSpacing: '0.005em',
            }}>
              A stitch has come loose.
            </h1>
            <p style={{
              fontSize: 14, color: '#5C4A52',
              margin: '14px auto 28px', lineHeight: 1.65,
              maxWidth: 380,
            }}>
              Something unexpected happened — but your work is safe. Try again, or return
              to the atelier while we mend it.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
              <GhostBtn label="Go Back" onClick={() => window.history.back()} />
              <PrimaryBtn label="Refresh" onClick={() => window.location.reload()} />
            </div>

            {/* Sentry user feedback */}
            {this.state.eventId && (
              <button
                onClick={() => Sentry.showReportDialog({ eventId: this.state.eventId })}
                style={{
                  background: 'transparent',
                  border: '1px solid #EDE7E2',
                  borderRadius: 2,
                  padding: '8px 18px',
                  fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
                  fontSize: 10, fontWeight: 500,
                  color: '#5C4A52',
                  textTransform: 'uppercase', letterSpacing: '0.16em',
                  cursor: 'pointer', marginBottom: 20,
                  transition: 'all 0.2s cubic-bezier(.22,.61,.36,1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#1C1118'; e.currentTarget.style.color = '#1C1118'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#EDE7E2'; e.currentTarget.style.color = '#5C4A52'; }}
              >
                Report this problem
              </button>
            )}

            {this.state.error && (
              <details style={{
                textAlign: 'left',
                background: '#F8F4F0',
                border: '1px solid #EDE7E2',
                padding: '14px 16px',
                borderRadius: 2,
                marginTop: 16,
              }}>
                <summary style={{
                  fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
                  fontSize: 10, color: '#5C4A52', cursor: 'pointer',
                  fontWeight: 500, outline: 'none',
                  textTransform: 'uppercase', letterSpacing: '0.16em',
                }}>
                  Technical details
                  {this.state.eventId && (
                    <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 10, color: '#7A6670', textTransform: 'none', letterSpacing: 0 }}>
                      (ID: {this.state.eventId})
                    </span>
                  )}
                </summary>
                <div style={{
                  marginTop: 12, fontSize: 11,
                  fontFamily: 'ui-monospace, "DM Mono", Menlo, monospace',
                  color: '#A34454',
                  whiteSpace: 'pre-wrap', overflowX: 'auto',
                  lineHeight: 1.6,
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
