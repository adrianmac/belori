import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Inject git SHA as build-time constant for Sentry release tracking
const gitSha = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'unknown' }
})()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Available in app as import.meta.env.VITE_APP_VERSION
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(gitSha),
  },
  build: {
    // Vite 8 uses Rolldown — manualChunks object form is not supported.
    // Dynamic imports in EventDetail already split jspdf/html2canvas correctly.
    // Raise the warning threshold since the 722kB main bundle is expected:
    chunkSizeWarningLimit: 800,
  },
})
