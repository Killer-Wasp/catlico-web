import { CaseTemplateEditorPage } from '#/components/Cases/CaseTemplateEditorPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/case-templates/$templateId')({
  component: RouteComponent,
})

function RouteComponent() {
  const { templateId } = Route.useParams()
  return <CaseTemplateEditorPage templateId={templateId} />
}
