import { CaseTemplateEditorPage } from '#/components/pages/CaseTemplateEditorPage'
import { caseTemplateQueryOptions } from '#/components/Cases/caseTemplatesQueries'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/case-templates/$templateId')({
  loader: ({ context, params }) =>
    params.templateId === 'new'
      ? undefined
      : context.queryClient.ensureQueryData(
          caseTemplateQueryOptions(params.templateId),
        ),
  component: RouteComponent,
})

function RouteComponent() {
  const { templateId } = Route.useParams()
  return <CaseTemplateEditorPage templateId={templateId} />
}
