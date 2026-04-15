import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Vite 8 uses Rolldown — manualChunks object form is not supported.
    // Dynamic imports in EventDetail already split jspdf/html2canvas correctly.
    // Raise the warning threshold since the 722kB main bundle is expected:
    chunkSizeWarningLimit: 800,
  },
})
