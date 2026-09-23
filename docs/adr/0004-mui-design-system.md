# ADR 0004: MUI as the frontend design system

- Status: Accepted
- Date: 2026-09-23

## Context

The SPA was built on **Radix Themes** with `accentColor="iris"`, `grayColor="slate"` and `radius="large"`, plus `react-hook-form` and Zod for forms and TanStack Query for server state. Radix Themes covered the whole surface: layout primitives, `Table`, `Select`, `AlertDialog`, `Callout`, and the light/dark theming behind the header toggle.

We wanted a broader component set than Radix Themes offers out of the box — in particular a data grid with sorting — and a single component vocabulary that new contributors are more likely to already know.

Running two design systems permanently was considered and rejected: two theming systems to keep in sync with the existing dark-mode toggle, two visual languages on the same screen, and both stylesheets shipped.

## Decision

Adopt **MUI 9** (`@mui/material`) with the **Emotion** styling engine as the single design system, and remove Radix Themes.

- Theme values are lifted from the Radix `iris` and `slate` scales so the rebuilt UI keeps the look the product already had, rather than landing on MUI's default blue. Typography uses Radix's system font stack, not MUI's Roboto-first default, which would otherwise request a webfont this project has never shipped.
- `ThemeProvider` keeps its existing public surface — the same `ThemeContext`, the same `teamflow-theme` storage key, the same system-preference listener — so `ThemeToggle` and `useThemePreference` were untouched by the swap.
- **`@mui/x-data-grid`** (Community, MIT) renders the workspace members table. Virtualisation is disabled there: member lists are small, and keeping every row in the DOM serves assistive technology as well as the tests.
- **TanStack Table** drives the task board, **TanStack Form** replaces `react-hook-form` across all seven forms (reusing the existing Zod schemas through Standard Schema), and **TanStack Virtual** windows task boards above 30 rows.
- Style props are passed through `sx`. MUI's polymorphic `component` prop and its system props (`fontWeight`, `maxWidth`, responsive `alignItems`) do not typecheck together — the overload resolves `component` as `string` and drops it.

We chose Emotion over `@mui/material-pigment-css`, which is an optional peer. Emotion is the default, better documented path; zero-runtime styling can be revisited if the bundle cost below becomes a problem.

## Consequences

Positive:

- One component vocabulary and one theme.
- Sorting on both the members grid and the task board, which the hand-rolled tables did not have.
- The stylesheet is gone: `styles.css` was 684 kB of the build output, now 0.02 kB.
- `AuthPage` no longer needs `as unknown as Resolver<RegisterValues>` to swap validation schemas by mode.

Negative:

- **The bundle got bigger.** Transferred JS + CSS went from 261 kB gzipped (594 kB JS + 684 kB CSS) to 391 kB gzipped (1,310 kB JS, no CSS) — about +50%. Radix shipped its styling as a stylesheet, which compresses far better than the equivalent Emotion runtime plus MUI's component code. The build warns that the chunk exceeds 500 kB. Route-level code splitting, starting with the DataGrid on the members route, is the obvious next step and has not been done.
- MUI's `Alert` carries `role="alert"` at every severity, where the Radix `Callout` it replaced had no role. Informational banners must pass `role="status"` explicitly or every empty state becomes an assertive screen-reader interruption. Likewise `Dialog` is `role="dialog"`; destructive confirmations pass `role="alertdialog"`.
- TanStack Form reads `defaultValues` when a field mounts, and a field that mounts *after* a `reset()` re-initialises from those defaults and silently discards the reset. Forms whose fields appear and disappear with a selection — the task detail form — must be remounted with a `key` rather than filled by resetting.
- `useVirtualizer` trips the React Compiler's `incompatible-library` lint warning, so that component is skipped for auto-memoisation.
- Virtualisation cannot be verified in jsdom, which reports zero layout height and leaves the window empty. That behaviour is covered by a Playwright spec instead.

## Alternatives considered

- **Keep Radix Themes.** Cheapest, and the stack was coherent. Rejected because we wanted the wider component set and a data grid.
- **Run both permanently.** Rejected: two theming systems and two visual languages, with both shipped.
- **MUI with Pigment CSS.** Zero-runtime styling would address the bundle regression, but it is an optional peer on a less-travelled path; revisit if the bundle becomes a real constraint.
- **TanStack Table for the members grid instead of DataGrid.** Rejected in favour of DataGrid there, since sorting, layout and the column model come built in; TanStack Table is used on the task board, where the rendering is bespoke.
