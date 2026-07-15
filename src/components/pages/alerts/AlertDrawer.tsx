import {
  alertCommentsQueryOptions,
  alertKeys,
  alertLinkedCasesQueryOptions,
  alertObservablesQueryOptions,
  alertQueryOptions,
  alertSimilarCasesQueryOptions,
  alertTagsQueryOptions,
  createAlertComment,
  detachAlertFromCase,
  setAlertTags,
} from '#/components/Alerts/alertsQueries'
import { caseKeys } from '#/components/Cases/casesQueries'
import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
import { CreateObservableDialog } from '#/components/Observables/CreateObservableDialog'
import { PluginPickerDialog } from '#/components/Plugins/PluginPickerDialog'
import type { PluginPickerSelection } from '#/components/Plugins/PluginPickerDialog'
import {
  dispatchAlertAnalyzerRuns,
  notifyAnalyzerRuns,
} from '#/components/Plugins/runAnalyzers'
import { pluginResultKeys } from '#/components/PluginResults/pluginResults'
import { recordRecentlyViewed } from '#/lib/recentlyViewed'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AlertDetailDrawer } from './AlertDetailDrawer'

/**
 * Connected wrapper around the presentational `AlertDetailDrawer`. It loads the
 * alert, its persisted comments, and its observables from the API, and posts new
 * comments — so every place that opens an alert drawer (the Alerts queue and a
 * case's linked alerts) shows the same data. The only difference is `hideActions`,
 * which the case view sets since a linked alert is already promoted.
 */
export function AlertDrawer({
  alertId,
  onClose,
  hideActions = false,
  caseTemplates,
  onDismiss,
  onMergeIntoCase,
  onPromote,
  promotionPending,
}: {
  alertId: string | null
  onClose: () => void
  hideActions?: boolean
  caseTemplates?: CaseTemplate[]
  onDismiss?: (id: string) => void
  onMergeIntoCase?: (id: string) => void
  onPromote?: (id: string, templateId: string) => void
  promotionPending?: boolean
}) {
  const queryClient = useQueryClient()
  const enabled = Boolean(alertId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [observableDialogOpen, setObservableDialogOpen] = useState(false)

  const { data: alert } = useQuery({
    ...alertQueryOptions(alertId ?? ''),
    enabled,
  })
  const { data: comments } = useQuery({
    ...alertCommentsQueryOptions(alertId ?? ''),
    enabled,
  })
  const { data: tags } = useQuery({
    ...alertTagsQueryOptions(alertId ?? ''),
    enabled,
  })
  const { data: observables } = useQuery({
    ...alertObservablesQueryOptions(alertId ?? ''),
    enabled,
  })
  const { data: similarCases } = useQuery({
    ...alertSimilarCasesQueryOptions(alertId ?? ''),
    enabled,
  })
  const { data: linkedCases } = useQuery({
    ...alertLinkedCasesQueryOptions(alertId ?? ''),
    enabled,
  })

  // Feed the search palette's "Recently viewed" list once the alert loads.
  useEffect(() => {
    if (!alertId || !alert) return
    recordRecentlyViewed({
      type: 'alert',
      id: alertId,
      label: `${alert.id} ${alert.title}`,
      route: { to: '/alerts/$alertId', params: { alertId } },
    })
    // Primitive deps (not the whole `alert` object) so a refetch that returns an
    // equal-but-new object doesn't needlessly rewrite localStorage.
  }, [alertId, alert?.id, alert?.title])

  const addComment = useMutation({
    mutationFn: createAlertComment,
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: alertKeys.comments(variables.alertId),
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to add comment',
      }),
  })

  const saveTags = useMutation({
    mutationFn: setAlertTags,
    onSuccess: (savedTags, variables) => {
      queryClient.setQueryData(alertKeys.tags(variables.alertId), savedTags)
      void queryClient.invalidateQueries({ queryKey: alertKeys.lists() })
      notifications.show({ color: 'green', message: 'Alert tags updated' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to update tags',
      }),
  })

  const detach = useMutation({
    mutationFn: detachAlertFromCase,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertKeys.all })
      void queryClient.invalidateQueries({ queryKey: caseKeys.all })
      notifications.show({ color: 'green', message: 'Alert detached from case' })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Unable to detach alert',
      }),
  })

  // "Run analyzers" fans the picked plugins out against the alert entity
  // (POST /alerts/{id}/plugin-runs), then refreshes the alert's Plugin Results.
  const runAnalyzers = useMutation({
    mutationFn: ({ pluginIds, force }: PluginPickerSelection) =>
      dispatchAlertAnalyzerRuns(alertId ?? '', pluginIds, force),
    onSuccess: (results) => {
      notifyAnalyzerRuns(results)
      if (alertId) {
        void queryClient.invalidateQueries({
          queryKey: pluginResultKeys.list(
            'alert',
            alertId.replace(/^AL-/, ''),
          ),
        })
      }
    },
    onSettled: () => setPickerOpen(false),
  })

  return (
    <>
      <AlertDetailDrawer
        alert={alertId ? (alert ?? null) : null}
        comments={comments ?? []}
        tags={tags ?? alert?.tags ?? []}
        onSaveTags={(id, nextTags) =>
          saveTags.mutateAsync({ alertId: id, tags: nextTags })
        }
        savingTags={saveTags.isPending}
        observables={observables ?? []}
        similarCases={similarCases ?? []}
        linkedCases={linkedCases ?? []}
        caseTemplates={caseTemplates}
        onClose={onClose}
        onAddComment={(id, note) => {
          const message = note.trim()
          if (!message) return
          addComment.mutate({ alertId: id, message })
        }}
        onRunAnalysis={() => setPickerOpen(true)}
        onAddObservable={() => setObservableDialogOpen(true)}
        onDismiss={onDismiss}
        onMergeIntoCase={onMergeIntoCase}
        onPromote={onPromote}
        promotionPending={promotionPending}
        onDetach={(id) => detach.mutate(id)}
        detachPending={detach.isPending}
        hideActions={hideActions}
      />
      {alertId && (
        <>
          <PluginPickerDialog
            opened={pickerOpen}
            onClose={() => setPickerOpen(false)}
            isRunning={runAnalyzers.isPending}
            contextLabel={`Run on alert ${alertId}`}
            onRun={(selection) => runAnalyzers.mutate(selection)}
          />
          <CreateObservableDialog
            opened={observableDialogOpen}
            alertId={alertId}
            onClose={() => setObservableDialogOpen(false)}
            onCreated={() =>
              queryClient.invalidateQueries({
                queryKey: alertKeys.observables(alertId),
              })
            }
          />
        </>
      )}
    </>
  )
}
