import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import { ThemeToggle } from '../theme/ThemeToggle.tsx'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/status', label: 'Status' },
]

// Hides the header once the page has scrolled past it and the user is
// scrolling down; a small threshold avoids flicker from trackpad jitter.
function useHeaderHidden() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const delta = y - lastY.current
      if (Math.abs(delta) > 8) {
        setHidden(delta > 0 && y > 64)
        lastY.current = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return hidden
}

export function AppShell({ children }: { children: ReactNode }) {
  const hidden = useHeaderHidden()

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <Box
        component="header"
        className={`app-header${hidden ? ' app-header-hidden' : ''}`}
        sx={(theme) => ({
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: alpha(theme.palette.background.default, 0.8),
          transition: 'transform 0.25s ease',
          '&.app-header-hidden': { transform: 'translateY(-100%)' },
          '& .brand-link': {
            color: theme.palette.text.primary,
            textDecoration: 'none',
            '&:hover': { color: theme.palette.primary.main },
          },
          '& .nav-link': {
            color: theme.palette.text.secondary,
            textDecoration: 'none',
            fontSize: theme.typography.body2.fontSize,
            fontWeight: 500,
            paddingBlock: theme.spacing(0.5),
            borderBottom: '2px solid transparent',
            '&:hover': { color: theme.palette.text.primary },
          },
          '& .nav-link-active': {
            color: theme.palette.primary.main,
            borderBottomColor: theme.palette.primary.main,
          },
        })}
      >
        <Container maxWidth="md">
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              // Matches the breakpoint the rest of the layout adapts at.
              paddingBlock: { xs: 1, sm: 1.5 },
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              <RouterLink to="/" className="brand-link">
                TeamFlow
              </RouterLink>
            </Typography>
            <Stack component="nav" aria-label="Primary" direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </Stack>
            <ThemeToggle />
          </Stack>
        </Container>
      </Box>
      <Container maxWidth="md" sx={{ paddingBlock: { xs: 3, sm: 5 } }}>
        {children}
      </Container>
    </Box>
  )
}
