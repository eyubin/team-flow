import { CheckIcon, DesktopIcon, MoonIcon, SunIcon } from '@radix-ui/react-icons'
import { DropdownMenu, Flex, IconButton } from '@radix-ui/themes'
import { useThemePreference } from './theme-context.ts'
import type { ThemePreference } from './theme-context.ts'

const OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <DesktopIcon /> },
]

export function ThemeToggle() {
  const { preference, appearance, setPreference } = useThemePreference()

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton variant="soft" color="gray" aria-label="Change theme" radius="full">
          {appearance === 'dark' ? <MoonIcon /> : <SunIcon />}
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {OPTIONS.map((option) => (
          <DropdownMenu.Item key={option.value} onSelect={() => setPreference(option.value)}>
            <Flex align="center" gap="2" width="100%">
              {option.icon}
              {option.label}
              {preference === option.value && <CheckIcon style={{ marginLeft: 'auto' }} />}
            </Flex>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
