import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Run unit/component tests (not E2E — those are under tests/e2e/)
    include: ['tests/unit/**/*.test.{js,jsx,ts,tsx}', 'src/**/*.test.{js,jsx,ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/e2e', '.claude/worktrees'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.js'],
    // Faster failure signal — tests should be quick
    testTimeout: 8000,
    hookTimeout: 8000,
    // Coverage — opt-in via `npm run test:coverage`
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'tests/**', 'dist/**', '**/*.config.*', 'scripts/**',
        'supabase/**', '.claude/**',
      ],
    },
  },
})
