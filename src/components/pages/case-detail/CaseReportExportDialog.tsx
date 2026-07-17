import { Stack, Text, UnstyledButton } from '@mantine/core'
import { AppDrawer } from '#/components/ui/AppDrawer'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import {
  renderReportTemplateHtml,
  reportTemplatesQueryOptions,
} from '#/components/pages/settings/settingsQueries'
import type { ReportTemplatePublic } from '#/components/pages/settings/settingsQueries'
import {
  ErrorPanel,
  LoadingPanel,
  notifyError,
} from '#/components/pages/settings/settingsUi'

/**
 * "Export report" flow for a case: pick a template, render it to HTML through
 * the api client (which attaches the bearer + org headers), then open the HTML
 * in a new tab via a Blob object URL. Rendering through the client — rather than
 * `window.open(renderUrl)` — is what keeps the auth token out of the URL while
 * still giving the user a print-friendly page.
 */
export function CaseReportExportDialog({
  caseId,
  caseNumber,
  opened,
  onClose,
}: {
  caseId: string
  caseNumber: string
  opened: boolean
  onClose: () => void
}) {
  const templatesQuery = reportTemplatesQueryOptions()
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    ...templatesQuery,
    // Keep the base query's org guard — only fetch once opened AND an org is set.
    enabled: opened && (templatesQuery.enabled ?? true),
  })

  const exportMutation = useMutation({
    mutationFn: (template: ReportTemplatePublic) =>
      renderReportTemplateHtml(template.id, caseId),
    onSuccess: (html) => {
      // Wrap the HTML in a Blob and open its object URL so the token never
      // appears in any URL.
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
      const handle = window.open(url, '_blank')
      if (!handle) {
        // Pop-up blocked: the render already succeeded so onError won't fire.
        // Revoke immediately, tell the user, and keep the dialog open to retry.
        URL.revokeObjectURL(url)
        notifyError(
          new Error(
            'Your browser blocked the report tab. Allow pop-ups for this site and try again.',
          ),
          'Unable to open report',
        )
        return
      }
      // Revoke well after the new tab has committed the blob document. Revoking
      // too eagerly (e.g. next tick) can blank the tab in Safari/Firefox; a
      // single-report leak reclaimed on unload is harmless.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      onClose()
    },
    onError: (error) => notifyError(error, 'Unable to render report'),
  })

  const templates = data ?? []

  return (
    <AppDrawer
      opened={opened}
      onClose={onClose}
      title={`Export report — case ${caseNumber}`}
    >
      {isPending ? (
        <LoadingPanel label="Loading report templates..." />
      ) : isError ? (
        <ErrorPanel
          label="Couldn't load report templates."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      ) : templates.length === 0 ? (
        <Text c="dimmed" size="sm">
          No report templates yet. An admin can add them in Settings → Report
          templates.
        </Text>
      ) : (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Pick a template to open a print-friendly report in a new tab.
          </Text>
          {templates.map((template) => (
            <UnstyledButton
              key={template.id}
              disabled={exportMutation.isPending}
              onClick={() => exportMutation.mutate(template)}
              p="sm"
              style={{
                borderRadius: 'var(--mantine-radius-md)',
                border: '1px solid var(--line-soft)',
                opacity: exportMutation.isPending ? 0.6 : undefined,
              }}
            >
              <Stack gap={2}>
                <Text fw={600}>
                  <FileText
                    size={14}
                    style={{ verticalAlign: 'middle', marginRight: 6 }}
                    aria-hidden
                  />
                  {template.name}
                </Text>
                {template.description ? (
                  <Text size="xs" c="dimmed">
                    {template.description}
                  </Text>
                ) : null}
              </Stack>
            </UnstyledButton>
          ))}
        </Stack>
      )}
    </AppDrawer>
  )
}
