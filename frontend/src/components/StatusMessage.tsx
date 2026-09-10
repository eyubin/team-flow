import { Text } from '@radix-ui/themes'

export type MessageTone = 'neutral' | 'success' | 'error'
export type StatusMessageValue = { text: string; tone: MessageTone } | null

/**
 * Single persistent aria-live region for form/mutation feedback.
 *
 * Kept mounted at all times (even with empty text) so assistive tech keeps
 * announcing updates reliably, while color/weight give sighted users a way
 * to tell an error apart from a success message at a glance instead of
 * having to read the copy.
 */
export function StatusMessage({ value }: { value: StatusMessageValue }) {
  const tone = value?.tone ?? 'neutral'
  return (
    <Text
      aria-live="polite"
      as="p"
      color={tone === 'error' ? 'red' : tone === 'success' ? 'grass' : 'gray'}
      weight={tone === 'error' ? 'medium' : undefined}
      size="2"
    >
      {value?.text ?? ''}
    </Text>
  )
}
