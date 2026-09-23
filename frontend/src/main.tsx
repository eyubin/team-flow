import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { ThemeProvider } from './components/theme/ThemeProvider.tsx'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
})

// Behind import.meta.env.DEV and a dynamic import, so the devtools are dropped
// from production builds entirely rather than shipped as dead weight.
const QueryDevtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then((module) => ({ default: module.ReactQueryDevtools })))
  : () => null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
      <Suspense>
        <QueryDevtools initialIsOpen={false} />
      </Suspense>
    </QueryClientProvider>
  </StrictMode>,
)
