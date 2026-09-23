import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../test/msw/server.ts'
import { problem, task, type Task } from '../test/msw/handlers.ts'
import { renderWithProviders } from '../test/render.tsx'
import { TaskBoardPage } from './TaskBoardPage.tsx'

function renderBoard() {
  return renderWithProviders(<TaskBoardPage />, {
    route: '/projects/project-1/tasks',
    path: '/projects/:projectId/tasks',
  })
}

function withTasks(...tasks: Task[]) {
  return http.get('/api/projects/:projectId/tasks', () => HttpResponse.json({ content: tasks }))
}

describe('TaskBoardPage', () => {
  it('offers reload after a task update conflict', async () => {
    const updatedElsewhere = { ...task, title: 'Updated elsewhere', version: 1 }
    server.use(
      withTasks(task),
      http.patch('/api/tasks/:taskId', () => problem(409, 'Task changed')),
      http.get('/api/tasks/:taskId', () => HttpResponse.json(updatedElsewhere)),
    )

    const { user } = renderBoard()

    await user.click(await screen.findByRole('button', { name: /Original task/ }))
    await user.click(await screen.findByRole('button', { name: 'Save task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('changed on the server')

    await user.click(screen.getByRole('button', { name: 'Reload task' }))

    await waitFor(() => expect(screen.getByDisplayValue('Updated elsewhere')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('requests filtered tasks from the API', async () => {
    const requested: string[] = []
    server.use(
      http.get('/api/projects/:projectId/tasks', ({ request }) => {
        requested.push(request.url)
        return HttpResponse.json({ content: [] })
      }),
    )

    const { user } = renderBoard()

    await user.click(await screen.findByLabelText('Filter status'))
    await user.click(await screen.findByRole('option', { name: 'Done' }))

    await waitFor(() => expect(requested.some((url) => url.includes('status=DONE'))).toBe(true))
  })

  it('shows a forbidden page when the project cannot be accessed', async () => {
    server.use(http.get('/api/projects/:projectId/tasks', () => problem(403, 'Not a member of this project')))

    renderBoard()

    expect(await screen.findByRole('heading', { name: /don't have permission to view this/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create task' })).not.toBeInTheDocument()
  })

  it('shows a retry banner when the task query fails outright', async () => {
    server.use(http.get('/api/projects/:projectId/tasks', () => problem(500, 'Boom')))

    renderBoard()

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load this project's tasks.")
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows a forbidden alert when a viewer tries to create a task', async () => {
    server.use(http.post('/api/projects/:projectId/tasks', () => problem(403, 'Viewers cannot create tasks')))

    const { user } = renderBoard()

    await user.type(await screen.findByLabelText('New task'), 'Ship the feature')
    await user.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("don't have permission")
  })

  it('deletes a task after the confirmation dialog is accepted', async () => {
    server.use(withTasks(task))

    const { user } = renderBoard()

    await user.click(await screen.findByRole('button', { name: /Original task/ }))
    await user.click(await screen.findByRole('button', { name: 'Delete task' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: /Original task/ })).not.toBeInTheDocument())
  })
})
