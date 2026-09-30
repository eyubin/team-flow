// Dual-screen and unfolded foldable devices spanning the page across both
// segments side by side, with the hinge (or fold) as a vertical strip between
// them. The env() values come from the Viewport Segments API; browsers without
// it never match the query, so none of this applies there.
export const SPANNING = '@media (horizontal-viewport-segments: 2)'

export const START_SEGMENT_WIDTH = 'env(viewport-segment-width 0 0)'
export const END_SEGMENT_WIDTH = 'env(viewport-segment-width 1 0)'
export const HINGE_WIDTH = 'calc(env(viewport-segment-left 1 0) - env(viewport-segment-right 0 0))'

export const SPANNING_COLUMNS = `${START_SEGMENT_WIDTH} ${HINGE_WIDTH} ${END_SEGMENT_WIDTH}`

// Marks a SplitView, so AppShell can let a page laid out across both segments
// use the full width.
export const SPLIT_VIEW_CLASS = 'split-view'
