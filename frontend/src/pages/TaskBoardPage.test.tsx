import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TaskBoardPage } from './TaskBoardPage.tsx'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

function renderBoard() {
  return render(
    <MemoryRouter initialEntries={['/projects/project-1/tasks']}>
      <Routes>
        <Route path="/projects/:projectId/tasks" element={<TaskBoardPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TaskBoardPage', () => {
  it('offers reload after a task update conflict', async () => {
    const task = { id: 'task-1', title: 'Original task', status: 'TODO', priority: 'MEDIUM', version: 0 }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({}, true, 204))
      .mockResolvedValueOnce(response({ content: [task] }))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ content: [] }))
      .mockResolvedValueOnce(response({}, false, 409))
      .mockResolvedValueOnce(response({ ...task, title: 'Updated elsewhere', version: 1 }))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({ content: [] }))
    vi.stubGlobal('fetch', fetchMock)

    renderBoard()
    fireEvent.click(await screen.findByRole('button', { name: /Original task/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('changed on the server')
    fireEvent.click(screen.getByRole('button', { name: 'Reload task' }))

    await waitFor(() => expect(screen.getByDisplayValue('Updated elsewhere')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('requests filtered tasks from the API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({}, true, 204))
      .mockResolvedValue(response({ content: [] }))
    vi.stubGlobal('fetch', fetchMock)

    renderBoard()
    const statusFilter = await screen.findByLabelText('Filter status')
    fireEvent.change(statusFilter, { target: { value: 'DONE' } })

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes('status=DONE'))).toBe(true))
  })
})
