import { describe, expect, it } from 'vitest'
import { sortRows } from './sort'

const rows = [{ name: 'banana' }, { name: 'Apple' }, { name: 'cherry' }]
const byName = (row: { name: string }) => row.name

describe('sortRows', () => {
  it('keeps the original order while no column is active', () => {
    expect(sortRows(rows, { active: '', direction: '' }, byName)).toEqual(rows)
  })

  it('sorts ascending and descending, ignoring case', () => {
    expect(sortRows(rows, { active: 'name', direction: 'asc' }, byName).map(byName)).toEqual(['Apple', 'banana', 'cherry'])
    expect(sortRows(rows, { active: 'name', direction: 'desc' }, byName).map(byName)).toEqual(['cherry', 'banana', 'Apple'])
  })

  it('does not mutate the input', () => {
    const input = [...rows]
    sortRows(input, { active: 'name', direction: 'asc' }, byName)
    expect(input).toEqual(rows)
  })
})
