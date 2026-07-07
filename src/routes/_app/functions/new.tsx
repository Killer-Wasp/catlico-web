import { FunctionsPage } from '#/components/pages/FunctionsPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/functions/new')({
  component: NewFunctionRoute,
})

function NewFunctionRoute() {
  return <FunctionsPage initialNew />
}
