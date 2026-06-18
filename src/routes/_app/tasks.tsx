import { TasksPage } from '#/components/pages/TasksPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/tasks')({ component: TasksPage })
