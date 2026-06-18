import { ConnectorsPage } from '#/components/pages/ConnectorsPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/connectors')({
  component: ConnectorsPage,
})
