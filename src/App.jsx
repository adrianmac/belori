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
import KioskPage from './pages/KioskPage'
import CatalogKioskPage from './pages/CatalogKioskPage'

const NotFound = () => (
  <div style={{ minHeight: '100vh', background: '#F8F4F0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif', gap: 12 }}>
    <div style={{ fontSize: 48, fontFamily: "'Playfair Display', serif", color: '#C9697A', fontWeight: 400 }}>404</div>
    <div style={{ fontSize: 18, fontWeight: 600, color: '#1C1012' }}>Page not found</div>
    <div style={{ fontSize: 14, color: '#6B7280' }}>This page doesn't exist or was moved.</div>
    <a href="/" style={{ marginTop: 8, color: '#C9697A', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>← Back to home</a>
  </div>
)

const Loading = () => (
  <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#6B7280' }}>
    Loading…
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
