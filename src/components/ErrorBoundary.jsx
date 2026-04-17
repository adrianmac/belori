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
          justifyContent: 'center', minHeight: '100vh', background: C.grayBg, padding: 24,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{
            background: C.white, borderRadius: 16, padding: '32px 40px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)', maxWidth: 500, width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.ink, marginBottom: 12 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: C.gray, marginBottom: 24, lineHeight: 1.5 }}>
              We encountered an unexpected error. Your data is safe. Please try refreshing the page
              or navigating back.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 }}>
              <GhostBtn label="Go Back" onClick={() => window.history.back()} />
              <PrimaryBtn label="Refresh Page" onClick={() => window.location.reload()} />
            </div>

            {/* Sentry user feedback (only if Sentry is active and captured an event) */}
            {this.state.eventId && (
              <button
                onClick={() => Sentry.showReportDialog({ eventId: this.state.eventId })}
                style={{
                  background: 'none', border: `1px solid ${C.gray}`, borderRadius: 8,
                  padding: '8px 16px', fontSize: 13, color: C.gray, cursor: 'pointer',
                  marginBottom: 16,
                }}
              >
                Report this problem
              </button>
            )}

            {this.state.error && (
              <details style={{ textAlign: 'left', background: C.grayBg, padding: 16, borderRadius: 8, marginTop: 8 }}>
                <summary style={{ fontSize: 13, color: C.gray, cursor: 'pointer', fontWeight: 500, outline: 'none' }}>
                  Technical details
                  {this.state.eventId && (
                    <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: 11 }}>
                      (ID: {this.state.eventId})
                    </span>
                  )}
                </summary>
                <div style={{ marginTop: 12, fontSize: 11, fontFamily: 'monospace', color: C.red, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
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
