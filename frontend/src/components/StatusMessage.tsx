import Typography from '@mui/material/Typography'

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
    <Typography
      aria-live="polite"
      component="p"
      variant="body2"
      color={tone === 'error' ? 'error.main' : tone === 'success' ? 'success.main' : 'text.secondary'}
      sx={{ fontWeight: tone === 'error' ? 500 : undefined }}
    >
      {value?.text ?? ''}
    </Typography>
  )
}
