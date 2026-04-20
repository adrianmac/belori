import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ModuleProvider } from './hooks/useModules.jsx'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ErrorBoundary from './components/ErrorBoundary'
import NovelApp from './pages/NovelApp'
import Onboarding from './pages/Onboarding'
import JoinInvite from './pages/JoinInvite'
import BookingPage from './pages/BookingPage'
import ScanPage from './pages/ScanPage'
import SignContractPage from './pages/SignContractPage'
import ClientPortalPage from './pages/ClientPortalPage'
import HomePage from './pages/HomePage'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import LeadForm from './pages/LeadForm'
import Questionnaire from './pages/Questionnaire'
import BoutiqueProfilePage from './pages/BoutiqueProfilePage'
import DataDeletionPage from './pages/DataDeletionPage'
import TermsOfService from './pages/legal/TermsOfService'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import SmsTerms from './pages/legal/SmsTerms'
import DataProcessingAgreement from './pages/legal/DataProcessingAgreement'
import KioskPage from './pages/KioskPage'
import CatalogKioskPage from './pages/CatalogKioskPage'

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
  )
}
