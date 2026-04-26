import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ModuleProvider } from './hooks/useModules.jsx'
import ErrorBoundary from './components/ErrorBoundary'

// Authenticated entry path — eager so first paint is fast for signed-in users
import NovelApp from './pages/NovelApp'

// Auth entry points — eager because they're the most-hit unauthenticated routes
import Login from './pages/Login'
import Signup from './pages/Signup'
import HomePage from './pages/HomePage'

// Everything below is reachable from a public URL but most authenticated
// users never visit them. Lazy-load to keep them out of the first-paint
// bundle. Each gets its own chunk that's fetched only on navigation.
const Onboarding              = lazy(() => import('./pages/Onboarding'))
const JoinInvite              = lazy(() => import('./pages/JoinInvite'))
const BookingPage             = lazy(() => import('./pages/BookingPage'))
const ScanPage                = lazy(() => import('./pages/ScanPage'))
const SignContractPage        = lazy(() => import('./pages/SignContractPage'))
const ClientPortalPage        = lazy(() => import('./pages/ClientPortalPage'))
const ForgotPassword          = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword           = lazy(() => import('./pages/ResetPassword'))
const LeadForm                = lazy(() => import('./pages/LeadForm'))
const Questionnaire           = lazy(() => import('./pages/Questionnaire'))
const BoutiqueProfilePage     = lazy(() => import('./pages/BoutiqueProfilePage'))
const DataDeletionPage        = lazy(() => import('./pages/DataDeletionPage'))
const TermsOfService          = lazy(() => import('./pages/legal/TermsOfService'))
const PrivacyPolicy           = lazy(() => import('./pages/legal/PrivacyPolicy'))
const SmsTerms                = lazy(() => import('./pages/legal/SmsTerms'))
const DataProcessingAgreement = lazy(() => import('./pages/legal/DataProcessingAgreement'))
const KioskPage               = lazy(() => import('./pages/KioskPage'))
const CatalogKioskPage        = lazy(() => import('./pages/CatalogKioskPage'))

// ─── Couture 404 — editorial fail ───────────────────────────────────────────
const NotFound = () => (
  <div style={{
    minHeight: '100vh', background: '#F8F4F0',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
    padding: 24, color: '#1C1118',
  }}>
    {/* Oversized editorial "404" — Italiana */}
    <div style={{
      fontFamily: "'Italiana','Didot',serif",
      fontSize: 'clamp(140px, 22vw, 260px)',
      color: '#B08A4E', lineHeight: 0.9, letterSpacing: '0.02em',
      textShadow: '0 2px 0 rgba(28,17,24,0.02)',
    }}>404</div>
    {/* Ornament rule */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 24px' }}>
      <span style={{ height: 1, width: 80, background: 'linear-gradient(90deg, transparent, #B08A4E)', opacity: 0.6 }} />
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M5 0l5 5-5 5-5-5 5-5z" fill="#B08A4E" opacity="0.85"/></svg>
      <span style={{ height: 1, width: 80, background: 'linear-gradient(270deg, transparent, #B08A4E)', opacity: 0.6 }} />
    </div>
    <h1 style={{
      fontFamily: "'Cormorant Garamond','Didot',Georgia,serif",
      fontSize: 28, fontStyle: 'italic', fontWeight: 400,
      color: '#1C1118', margin: 0, textAlign: 'center',
    }}>
      This page has gone missing.
    </h1>
    <p style={{
      fontSize: 13, color: '#5C4A52', marginTop: 14, textAlign: 'center',
      maxWidth: 360, lineHeight: 1.6,
    }}>
      Perhaps it was never here, or it stepped out for a fitting. Either way,
      we'll see you back at the atelier.
    </p>
    <a href="/" style={{
      marginTop: 32,
      fontSize: 11, color: '#1C1118',
      textTransform: 'uppercase', letterSpacing: '0.18em',
      padding: '12px 26px', border: '1px solid #1C1118',
      textDecoration: 'none', transition: 'all 0.25s cubic-bezier(.22,.61,.36,1)',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = '#1C1118'; e.currentTarget.style.color = '#FEFBF7'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1C1118'; }}
    >
      Return to the atelier
    </a>
  </div>
)

// ─── Couture loading — ornament + soft pulse ──────────────────────────────
const Loading = () => (
  <div style={{
    height: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: '#F8F4F0',
    fontFamily: "'DM Sans','Inter',system-ui,sans-serif",
  }}>
    <div style={{
      fontFamily: "'Italiana','Didot',serif",
      fontSize: 36, color: '#1C1118', letterSpacing: '0.02em',
      animation: 'coutureLoadPulse 2.4s ease-in-out infinite',
    }}>Belori</div>
    <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10, opacity: 0.6 }}>
      <span style={{ height: 1, width: 40, background: 'linear-gradient(90deg, transparent, #B08A4E)' }} />
      <svg width="6" height="6" viewBox="0 0 10 10" fill="none"><path d="M5 0l5 5-5 5-5-5 5-5z" fill="#B08A4E"/></svg>
      <span style={{ height: 1, width: 40, background: 'linear-gradient(270deg, transparent, #B08A4E)' }} />
    </div>
    <div style={{
      marginTop: 14, fontSize: 10, color: '#7A6670',
      textTransform: 'uppercase', letterSpacing: '0.28em',
    }}>Preparing your atelier</div>
    <style>{`@keyframes coutureLoadPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }`}</style>
  </div>
)

// Requires session + boutique
function PrivateRoute({ children }) {
  const { session, boutique, loading } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (!boutique) return <Navigate to="/onboarding" replace />
  return children
}

// Requires session only (no boutique needed — used for onboarding)
// If user already has a boutique, skip onboarding and go straight to the app
function SessionRoute({ children }) {
  const { session, boutique, loading } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (boutique) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/join/:token" element={<JoinInvite />} />
        <Route path="/book/:slug" element={<BookingPage />} />
        <Route path="/scan/:id" element={<ScanPage />} />
        <Route path="/sign/:token" element={<SignContractPage />} />
        <Route path="/portal/:token" element={<ClientPortalPage />} />
        <Route path="/lead/:boutiqueId" element={<LeadForm />} />
        <Route path="/questionnaire/:eventToken" element={<Questionnaire />} />
        <Route path="/boutique/:slug" element={<BoutiqueProfilePage />} />
        <Route path="/data-deletion" element={<DataDeletionPage />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/sms-terms" element={<SmsTerms />} />
        <Route path="/dpa" element={<DataProcessingAgreement />} />
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="/catalog-kiosk" element={<CatalogKioskPage />} />
        <Route path="/onboarding" element={<SessionRoute><Onboarding /></SessionRoute>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/*" element={
          <ErrorBoundary>
            <PrivateRoute>
              <ModuleProvider>
                <NovelApp />
              </ModuleProvider>
            </PrivateRoute>
          </ErrorBoundary>
        } />
      </Routes>
    </Suspense>
  )
}
