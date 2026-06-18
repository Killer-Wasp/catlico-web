import { ObservablesPage } from '#/components/pages/ObservablesPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/observables')({
  component: ObservablesPage,
})
