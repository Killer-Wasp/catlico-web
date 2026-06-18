import { CreateCasePage } from '#/components/pages/CreateCasePage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/cases/create')({
  component: CreateCasePage,
})
