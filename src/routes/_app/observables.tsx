import { ObservablesPage } from '#/components/Observables/ObservablesPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/observables')({
  component: ObservablesPage,
})
