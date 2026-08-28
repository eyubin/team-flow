import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { createTestQueryClient } from '../test/queryClient.ts'
import { TaskBoardPage } from './TaskBoardPage.tsx'

function response(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

function renderBoard() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/projects/project-1/tasks']}>
        <Routes>
          <Route path="/projects/:projectId/tasks" element={<TaskBoardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
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

  it('shows a forbidden page when the project cannot be accessed', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({}, true, 204))
      .mockResolvedValueOnce(response({ detail: 'Not a member of this project' }, false, 403))
    vi.stubGlobal('fetch', fetchMock)

    renderBoard()

    expect(await screen.findByRole('heading', { name: /don't have permission to view this/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create task' })).not.toBeInTheDocument()
  })

  it('shows a forbidden alert when a viewer tries to create a task', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({}, true, 204))
      .mockResolvedValueOnce(response({ content: [] }))
      .mockResolvedValueOnce(response({}, false, 403))
    vi.stubGlobal('fetch', fetchMock)

    renderBoard()
    fireEvent.change(await screen.findByLabelText('New task'), { target: { value: 'Ship the feature' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("don't have permission")
  })
})
