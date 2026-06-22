import { ConnectorJobsPage } from '#/components/pages/ConnectorJobsPage'
import { analyzerJobsQueryOptions } from '#/components/Connectors/connectorJobs'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connector-jobs')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(analyzerJobsQueryOptions()),
  component: ConnectorJobsPage,
})
