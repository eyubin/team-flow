import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: backendTarget, changeOrigin: true },
      '/actuator': { target: backendTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      // Report on every source file, not just the ones a test happened to
      // import - otherwise an untested module is invisible rather than a 0%.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
      // Set just under the current numbers: enough to catch a regression,
      // without failing the build the first time someone adds a branch.
      thresholds: { statements: 80, branches: 70, functions: 73, lines: 83 },
    },
  },
})
