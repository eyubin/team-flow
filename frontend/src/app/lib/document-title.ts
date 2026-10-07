import { DestroyRef, effect, inject } from '@angular/core'

/**
 * Sets document.title for the active route and restores the previous value
 * when the component is destroyed. The router doesn't do full page
 * navigations, so without this every route shares the static title from
 * index.html: browser tabs/history all read "TeamFlow", and screen readers
 * (which announce title changes on route change) never learn a navigation
 * happened.
 *
 * Takes a function so a title derived from signals (e.g. the auth page's
 * mode) stays current. Must be called in an injection context.
 */
export function injectDocumentTitle(title: () => string) {
  const previous = document.title
  effect(() => {
    const current = title()
    document.title = current ? `${current} · TeamFlow` : 'TeamFlow'
  })
  inject(DestroyRef).onDestroy(() => {
    document.title = previous
  })
}
