import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider } from './context/AuthContext'
import { LayoutModeProvider } from './hooks/useLayoutMode.jsx'
import { I18nProvider } from './lib/i18n/index.jsx'
import App from './App.jsx'
import './index.css'
import { applyTheme, getTheme } from './lib/theme.js'

applyTheme(getTheme())

// ─── Sentry error monitoring ──────────────────────────────────────────────────
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,               // 'production' | 'development'
    release: import.meta.env.VITE_APP_VERSION ?? 'unknown',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text and block all media in session replays (privacy-first)
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance: capture 10% of traces in prod, 100% in dev
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Session replays: 1% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    // Don't send errors in development unless VITE_SENTRY_DSN is explicitly set
    enabled: !!SENTRY_DSN,
    beforeSend(event) {
      // Strip any PII that may appear in breadcrumbs or request data
      if (event.request?.cookies) delete event.request.cookies
      if (event.user?.email) event.user.email = '[filtered]'
      return event
    },
  })
}

// ─── Service worker (PWA + offline) ──────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LayoutModeProvider>
        <I18nProvider initialLang={localStorage.getItem('belori_lang') || 'en'}>
          <AuthProvider>
            <App />
            {/* Vercel Analytics — pageview + custom events */}
            <Analytics />
            {/* Vercel Speed Insights — Core Web Vitals */}
            <SpeedInsights />
          </AuthProvider>
        </I18nProvider>
      </LayoutModeProvider>
    </BrowserRouter>
  </StrictMode>
)
