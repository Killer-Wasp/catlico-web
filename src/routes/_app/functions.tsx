import { FunctionsPage } from '#/components/Functions/FunctionsPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/functions')({
  component: FunctionsPage,
})
