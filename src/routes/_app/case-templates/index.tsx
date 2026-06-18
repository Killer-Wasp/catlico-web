import { CaseTemplatesPage } from '#/components/pages/CaseTemplatesPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/case-templates/')({
  component: CaseTemplatesPage,
})
