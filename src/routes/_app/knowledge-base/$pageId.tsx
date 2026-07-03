import { KnowledgeBasePage } from '#/components/pages/KnowledgeBasePage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/knowledge-base/$pageId')({
  component: KnowledgeBasePage,
})
