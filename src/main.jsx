import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LayoutModeProvider } from './hooks/useLayoutMode.jsx'
import { I18nProvider } from './lib/i18n/index.jsx'
import App from './App.jsx'
import './index.css'
import { applyTheme, getTheme } from './lib/theme.js'

applyTheme(getTheme())

// Register service worker for PWA + offline support
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
          </AuthProvider>
        </I18nProvider>
      </LayoutModeProvider>
    </BrowserRouter>
  </StrictMode>
)
