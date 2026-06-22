import { ConnectorsPage } from '#/components/pages/ConnectorsPage'
import { connectorsQueryOptions } from '#/components/Connectors/connectors'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connectors')({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(connectorsQueryOptions()),
  component: ConnectorsPage,
})
