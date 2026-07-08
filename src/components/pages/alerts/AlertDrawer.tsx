import {
  alertCommentsQueryOptions,
  alertKeys,
  alertObservablesQueryOptions,
  alertQueryOptions,
  alertSimilarCasesQueryOptions,
  alertTagsQueryOptions,
  createAlertComment,
  setAlertTags,
} from '#/components/Alerts/alertsQueries'
import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  onRunAnalysis,
}: {
  alertId: string | null
  onClose: () => void
  hideActions?: boolean
  caseTemplates?: CaseTemplate[]
  onDismiss?: (id: string) => void
  onMergeIntoCase?: (id: string) => void
  onPromote?: (id: string, templateId: string) => void
  promotionPending?: boolean
  onRunAnalysis?: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const enabled = Boolean(alertId)

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

  const runAnalysis =
    onRunAnalysis ??
    ((id: string) =>
      notifications.show({
        color: 'blue',
        message: `Running analysis on ${id}…`,
      }))

  return (
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
      caseTemplates={caseTemplates}
      onClose={onClose}
      onAddComment={(id, note) => {
        const message = note.trim()
        if (!message) return
        addComment.mutate({ alertId: id, message })
      }}
      onRunAnalysis={runAnalysis}
      onDismiss={onDismiss}
      onMergeIntoCase={onMergeIntoCase}
      onPromote={onPromote}
      promotionPending={promotionPending}
      hideActions={hideActions}
    />
  )
}
