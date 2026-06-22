import { TasksPage } from '#/components/pages/TasksPage'
import {
  DEFAULT_TASK_FILTERS,
  tasksQueryOptions,
} from '#/components/Tasks/tasksQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/tasks')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(
      tasksQueryOptions(DEFAULT_TASK_FILTERS),
    ),
  component: TasksPage,
})
