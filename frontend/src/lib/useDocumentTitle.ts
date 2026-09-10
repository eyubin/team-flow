import { useEffect } from 'react'

/**
 * Sets document.title for the active route and restores the previous value
 * on unmount. React Router doesn't do full page navigations, so without this
 * every route shares the static title from index.html: browser tabs/history
 * all read "TeamFlow", and screen readers (which announce title changes on
 * route change) never learn a navigation happened.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · TeamFlow` : 'TeamFlow'
    return () => {
      document.title = previous
    }
  }, [title])
}
