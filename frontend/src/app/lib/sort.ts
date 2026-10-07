import type { Sort } from '@angular/material/sort'

/**
 * Sorts rows by the active `matSort` column without mutating them. Values are
 * compared as text (case-insensitive, numeric-aware), which is what every
 * sortable column in the app holds. An inactive sort keeps the server's order.
 */
export function sortRows<T>(rows: readonly T[], sort: Sort, value: (row: T, column: string) => string): T[] {
  if (!sort.active || !sort.direction) return [...rows]
  const direction = sort.direction === 'asc' ? 1 : -1
  return [...rows].sort(
    (a, b) =>
      direction *
      value(a, sort.active).localeCompare(value(b, sort.active), undefined, { sensitivity: 'base', numeric: true }),
  )
}
