import type { ReactNode } from 'react'
import { styled } from '@mui/material/styles'
import { SPANNING, SPANNING_COLUMNS, SPLIT_VIEW_CLASS } from './fold.ts'

type SplitViewProps = {
  start: ReactNode
  end: ReactNode
  /** Fills the second segment while `end` is empty; never shown on a single screen. */
  placeholder?: ReactNode
  footer?: ReactNode
}

// styled() rather than sx: these styles never change with props, so they are
// serialised once when the module loads instead of on every render.
const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(4),
  [SPANNING]: {
    display: 'grid',
    gridTemplateColumns: SPANNING_COLUMNS,
    // The first row fits the start pane; the footer row takes whatever height
    // is left beside a taller end pane, so no gap opens above the footer.
    gridTemplateRows: 'auto 1fr',
    columnGap: 0,
  },
}))

const Pane = styled('div')(({ theme }) => ({
  [SPANNING]: { minWidth: 0, paddingInline: theme.spacing(3) },
}))

const Start = styled(Pane)({
  [SPANNING]: { gridColumn: 1, gridRow: 1 },
})

const End = styled(Pane)({
  [SPANNING]: { gridColumn: 3, gridRow: '1 / span 2' },
})

const Placeholder = styled(End)(({ theme }) => ({
  display: 'none',
  color: theme.palette.text.secondary,
  [SPANNING]: { display: 'block' },
}))

const Footer = styled(Pane)(({ theme }) => ({
  [SPANNING]: { gridColumn: 1, gridRow: 2, alignSelf: 'start', marginTop: theme.spacing(4) },
}))

/**
 * One column on a single screen: start, end, then footer. Spanned across a
 * dual-screen or foldable device, start and footer take the first segment and
 * end takes the second, so nothing sits under the hinge.
 *
 * Layout is CSS only, so folding or unfolding the device never remounts the
 * panes and never throws away a half-filled form.
 */
export function SplitView({ start, end, placeholder, footer }: SplitViewProps) {
  return (
    <Root className={SPLIT_VIEW_CLASS}>
      <Start>{start}</Start>
      {end ? <End>{end}</End> : placeholder && <Placeholder>{placeholder}</Placeholder>}
      {footer && <Footer>{footer}</Footer>}
    </Root>
  )
}
