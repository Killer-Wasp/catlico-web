import { ConnectorJobsPage } from '#/components/pages/ConnectorJobsPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connector-jobs')({
  component: ConnectorJobsPage,
})
