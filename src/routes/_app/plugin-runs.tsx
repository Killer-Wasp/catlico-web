import { createFileRoute } from '@tanstack/react-router'
import { RunsPage } from '#/components/pages/plugins/runs/RunsPage'

export const Route = createFileRoute('/_app/plugin-runs')({
  component: RunsPage,
})
