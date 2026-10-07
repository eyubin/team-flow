# ADR 0006: Angular replaces React for the SPA

- Status: Accepted
- Date: 2026-10-07
- Supersedes: [ADR 0004](0004-mui-design-system.md) (MUI); amends [ADR 0005](0005-tailwind-utilities.md) (Tailwind)

## Context

The SPA was React 19 + Vite, with MUI as the design system (ADR 0004), Tailwind for layout utilities (ADR 0005), TanStack Query/Form/Table/Virtual, and Vitest + React Testing Library + MSW for unit tests. We are moving the frontend to Angular.

The rewrite should change the framework, not the product. The Playwright suite, the Docker image, nginx, Compose and CI should not notice the change: the same routes, the same accessible names and roles, the same `npm run lint | typecheck | test:coverage | build | dev` scripts, the same `dist/` output and the same dev-server port and proxy.

## Decision

Rewrite the SPA in place on **Angular 22**: standalone components, signals, zoneless change detection and `OnPush` throughout.

- **Build: Angular CLI** (`@angular/build`, esbuild). `ng serve` keeps port 5173 and proxies `/api` and `/actuator` to `BACKEND_PROXY_TARGET` (`proxy.conf.mjs`), so `make dev` is unchanged. `ng build` writes straight to `dist/`, so the Dockerfile and nginx are unchanged.
- **Design system: Angular Material** (M3), replacing MUI. `styles.scss` builds the theme with `theme-type: color-scheme` and overrides the system tokens with the same Radix `iris`/`slate` values the MUI theme used, so the product keeps its look. The system font stack still leads, so no webfont is requested. Material has no alert or static chip, so `app-alert` and `app-badge` are small local components. Icons are inline SVG paths (`app-icon`) rather than an icon font, for the same reason.
- **Dark mode** is a `ThemeService` that sets `color-scheme` on `<html>`. Every Material token is a `light-dark()` value, so the one property switches the whole palette. The `teamflow-theme` storage key and the system-preference behaviour are unchanged.
- **Tailwind stays a utility layer** (ADR 0005), now through `@tailwindcss/postcss`. Its colour tokens read Material's `--mat-sys-*` variables instead of `--mui-palette-*`, and the breakpoints are unchanged. One difference: Material's component styles are not in a cascade layer, so a utility that has to beat a Material style *on a Material element* needs Tailwind's `!` modifier. Utilities on the app's own elements win as before.
- **Server state: TanStack Angular Query** (`@tanstack/angular-query-experimental`). `queryKeys`, the query functions, `lib/api.ts` and the session handling (`onUnauthorized`, the `teamflow-auth` BroadcastChannel) carry over unchanged.
- **Forms: typed Reactive Forms with Angular's built-in validators**, replacing TanStack Form and Zod. The fields use `Validators.required`, `minLength` and `email`; the inputs' `maxlength` attributes register Angular's max-length validator; and three small validators in `lib/form-validation.ts` cover the rest (`notBlank`, `matchesControl` for the password confirmation, and `requiredWhen` for the current password when the email changes). Each form keeps an error-key → message map, so the copy is unchanged. A global `SubmittedErrorStateMatcher` keeps the old timing: nothing is flagged until the form is submitted.
- **Tables:** the members table is `mat-table` and the task board is a native `<table>`, both sorted through `matSort` (`lib/sort.ts`). The board still windows above 30 rows with **TanStack Angular Virtual**, and the table's parent is still the scroll container. TanStack Table is dropped, since all it did here was sort three columns. `MatDialog` opens the confirmations with `role: 'alertdialog'`.
- **Routing:** route params arrive as component inputs (`withComponentInputBinding`). `RequireAuthComponent` is the parent route for signed-in pages, with the same loading, retry and redirect behaviour as before. Every route except the landing page is lazily loaded.
- **Unit tests: Vitest through `ng test`**, with Angular Testing Library and the existing MSW handlers. Specs keep the same queries and assertions as the React tests; `test/render.ts` is again the one place that knows the providers. The coverage thresholds carry over unchanged.

## Consequences

Positive:

- The e2e suite, Compose, the Docker image and CI needed no changes. The rewrite is held to the same user-visible contract.
- The task board's windowing is now unit-tested: a spec gives the scroll container a height (jsdom does no layout) and asserts that only a window of rows renders. Before, only Playwright covered it.
- Coverage is above the old thresholds (about 91% statements, 87% branches).

Negative:

- **TypeScript is pinned to 6.0.** Angular 22's compiler supports `>=6.0 <6.1`; the React build used TypeScript 7.
- The first visit is 822 kB raw / about 197 kB transferred, slightly below the roughly 208 kB gzipped of the React/MUI build. Angular core and Material/CDK make up most of it. Dropping Zod saved about 20 kB transferred (72 kB raw); its class-based API does not tree-shake, so named imports made no difference. The production budget warns at 950 kB.
- Validation messages now live in per-form maps rather than in a schema. A new validator needs a matching message entry, or `errorMessage` returns nothing for it.
- TanStack Angular Query is still published as `-experimental`. Its API may change in minor releases.
- Material's `mat-error` gets `role="alert"` explicitly, so that validation messages are announced as they were with MUI's helper text.

## Alternatives considered

- **HttpClient + signals instead of TanStack Query.** More Angular-native, but it would mean redesigning the cache keys, invalidation and focus refetch that the current code relies on. Rejected for this migration.
- **PrimeNG, or Tailwind-only components.** PrimeNG has a stronger data grid, but Angular Material is the closest equivalent to MUI. Building every component by hand in Tailwind would have meant more code to own.
- **A side-by-side `frontend-angular/` app.** Rejected: the Playwright suite already defines parity, so an in-place rewrite gives one cut-over with no period of running two apps.
