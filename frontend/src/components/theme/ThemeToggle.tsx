import { useState } from 'react'
import type { MouseEvent } from 'react'
import CheckIcon from '@mui/icons-material/Check'
import ComputerIcon from '@mui/icons-material/Computer'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useThemePreference } from './theme-context.ts'
import type { ThemePreference } from './theme-context.ts'

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <LightModeIcon fontSize="small" /> },
  { value: 'dark', label: 'Dark', icon: <DarkModeIcon fontSize="small" /> },
  { value: 'system', label: 'System', icon: <ComputerIcon fontSize="small" /> },
]

export function ThemeToggle() {
  const { preference, appearance, setPreference } = useThemePreference()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  function choose(value: ThemePreference) {
    setPreference(value)
    setAnchorEl(null)
  }

  return (
    <>
      <IconButton
        aria-label="Change theme"
        color="inherit"
        size="small"
        onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
      >
        {appearance === 'dark' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {OPTIONS.map((option) => (
          <MenuItem key={option.value} onClick={() => choose(option.value)} selected={preference === option.value}>
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
            {preference === option.value && <CheckIcon fontSize="small" sx={{ ml: 1 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
