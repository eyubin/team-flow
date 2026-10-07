// Same contract as the old Vite proxy: Compose's dev profile points this at the
// backend container through BACKEND_PROXY_TARGET.
const target = process.env.BACKEND_PROXY_TARGET ?? 'http://localhost:8080'

export default {
  '/api': { target, changeOrigin: true },
  '/actuator': { target, changeOrigin: true },
}
