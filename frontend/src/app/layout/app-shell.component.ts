import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Link as RouterLink } from 'react-router-dom'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, styled } from '@mui/material/styles'
import { ThemeToggle } from '../theme/ThemeToggle.tsx'
import { SPANNING, SPLIT_VIEW_CLASS, START_SEGMENT_WIDTH } from './fold.ts'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/status', label: 'Status' },
]

const Header = styled('header')(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 10,
  backdropFilter: 'blur(8px)',
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: alpha(theme.palette.background.default, 0.8),
  transition: 'transform 0.25s ease',
  '&.app-header-hidden': { transform: 'translateY(-100%)' },
}))

const BrandLink = styled(RouterLink)(({ theme }) => ({
  color: theme.palette.text.primary,
  textDecoration: 'none',
  '&:hover': { color: theme.palette.primary.main },
}))

// NavLink sets aria-current="page" on the link for the current route.
const NavItem = styled(NavLink)(({ theme }) => ({
  color: theme.palette.text.secondary,
  textDecoration: 'none',
  fontSize: theme.typography.body2.fontSize,
  fontWeight: 500,
  paddingBlock: theme.spacing(0.5),
  borderBottom: '2px solid transparent',
  '&:hover': { color: theme.palette.text.primary },
  '&[aria-current="page"]': {
    color: theme.palette.primary.main,
    borderBottomColor: theme.palette.primary.main,
  },
}))

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
    <Box sx={{ minHeight: '100dvh' }}>
      <Header className={hidden ? 'app-header-hidden' : undefined}>
        <Container maxWidth="md" sx={{ [SPANNING]: { maxWidth: 'none', px: 0 } }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              alignItems: 'center',
              justifyContent: 'space-between',
              // Matches the breakpoint the rest of the layout adapts at.
              paddingBlock: { xs: 1, sm: 1.5 },
              // Kept on the first segment so the nav never straddles the hinge.
              [SPANNING]: { width: START_SEGMENT_WIDTH, px: 3 },
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              <BrandLink to="/">TeamFlow</BrandLink>
            </Typography>
            <Stack component="nav" aria-label="Primary" direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              {NAV_ITEMS.map((item) => (
                <NavItem key={item.to} to={item.to}>
                  {item.label}
                </NavItem>
              ))}
            </Stack>
            <ThemeToggle />
          </Stack>
        </Container>
      </Header>
      <Container
        maxWidth="md"
        sx={{
          paddingBlock: { xs: 3, sm: 5 },
          // Spanned across two segments, a page stays on the first one unless
          // it lays itself out across both with SplitView.
          [SPANNING]: {
            maxWidth: 'none',
            px: 0,
            '& > main': { width: START_SEGMENT_WIDTH, px: 3 },
            [`& > main:has(> .${SPLIT_VIEW_CLASS})`]: { width: 'auto', px: 0 },
          },
        }}
      >
        {children}
      </Container>
    </Box>
  )
}
