import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { NavLink, Link as RouterLink } from 'react-router-dom'
import { Box, Container, Flex, Heading } from '@radix-ui/themes'
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
    <Box minHeight="100vh">
      <Box
        asChild
        position="sticky"
        top="0"
        style={{ zIndex: 10, backdropFilter: 'blur(8px)' }}
        className={hidden ? 'app-header-hidden' : undefined}
      >
        <header className="app-header">
          <Container size="3" px={{ initial: '4', sm: '5' }}>
            <Flex align="center" justify="between" className="app-header-inner" gap="4">
              <Heading asChild size={{ initial: '3', sm: '4' }} weight="bold">
                <RouterLink to="/" className="brand-link">
                  TeamFlow
                </RouterLink>
              </Heading>
              <Flex asChild align="center" gap="4">
                <nav aria-label="Primary">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              </Flex>
              <ThemeToggle />
            </Flex>
          </Container>
        </header>
      </Box>
      <Container size="3" px={{ initial: '4', sm: '5' }} py={{ initial: '5', sm: '7' }}>
        {children}
      </Container>
    </Box>
  )
}
