# ADR 0005: Tailwind for layout utilities alongside MUI

- Status: Accepted
- Date: 2026-09-23
- Amends: [ADR 0004](0004-mui-design-system.md)

## Context

ADR 0004 made MUI the single design system and rejected running two, citing two theming systems to keep in sync with the dark-mode toggle, two visual languages on one screen, and both stylesheets shipped.

We want Tailwind's utility classes for layout and spacing: `className="flex gap-4 md:grid"` is shorter and easier to scan than the equivalent `sx` object. We want that without reopening the problems ADR 0004 avoided.

## Decision

Add **Tailwind CSS 4** through `@tailwindcss/vite`, as a utility layer that sits *under* MUI's ownership of components and colour, not as a second design system.

- **MUI stays the design system.** Components, typography and colour come from MUI. Tailwind is for layout, spacing, sizing and similar one-off utilities. Anything with a theme-aware look (colours, variants, component overrides) belongs in `muiTheme.ts` or `sx`.
- **One reset.** Tailwind's Preflight is not imported; MUI's `CssBaseline` remains the only reset. `index.css` imports `tailwindcss/theme.css` and `tailwindcss/utilities.css` individually instead of `tailwindcss`.
- **Explicit cascade order.** `index.css` declares `@layer theme, base, mui, components, utilities`, and `StyledEngineProvider enableCssLayer` puts Emotion's output in `mui`. A utility class on an MUI component therefore wins without `!important`, and the order does not depend on which stylesheet happens to load first.
- **One set of colour values.** The MUI theme sets `cssVariables: true`, so the palette is emitted as `--mui-palette-*` on `:root`. Tailwind's default palette is removed (`--color-*: initial`) and replaced with tokens that read those variables: `primary`, `primary-dark`, `primary-light`, `primary-contrast`, `error`, `warning`, `info`, `success`, `background`, `paper`, `text`, `text-secondary`, `divider`, plus `white`, `black`, `transparent` and `current`. `bg-paper` or `text-primary` follows the dark-mode toggle, and `text-red-500` generates nothing.
- **Shared breakpoints.** Tailwind's breakpoints are redefined to MUI's (600 / 900 / 1200 / 1536 px), so `md:` and `theme.breakpoints.up('md')` agree. Tailwind's `2xl` is removed; MUI has no equivalent.

Existing `sx` usage is not migrated. New code may use either `sx` or Tailwind classes for layout.

## Consequences

Positive:

- Terse layout code, and no second theme to keep in sync: colours and breakpoints have one source.
- Small CSS cost: Tailwind generates only the classes it finds in `src`. The stylesheet is 3.2 kB before any utilities are used.

Negative:

- Two ways to write layout (`sx` and `className`). Reviewers should push new colour or component styling toward the theme, not Tailwind.
- `cssVariables: true` changes how MUI emits styles. Palette values now resolve through `var(--mui-palette-*)`. `theme.palette.*` still holds the raw hex values, so existing code that reads them is unaffected.
- Tailwind's spacing scale is 4 px per step and MUI's is 8 px: `p-2` equals `theme.spacing(1)`. The scales are not reconciled, since both are internally consistent.
- Utility classes are not checked by TypeScript or oxlint. A typo is silently dropped.

## Alternatives considered

- **Full Tailwind with Preflight and its default palette.** Rejected: two resets and two colour languages, which is what ADR 0004 ruled out.
- **Copy the palette into Tailwind's `@theme` as hex values.** Rejected: that duplicates `muiTheme.ts` and needs a separate dark-mode mechanism (a `dark:` variant tied to the toggle).
- **Stay on `sx` only.** Still viable; rejected only because of how verbose `sx` is for layout.
