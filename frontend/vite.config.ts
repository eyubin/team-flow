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
  },
})
