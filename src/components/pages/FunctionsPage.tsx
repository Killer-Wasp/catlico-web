import classes from '#/components/Cases/CasesPage.module.css'
import {
  createFunction,
  deleteFunction,
  functionKeys,
  functionsQueryOptions,
  updateFunction,
} from '#/components/Functions/functionsQueries'
import { Box, Button, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { FunctionEditor } from './functions/FunctionEditor'
import { FunctionsList } from './functions/FunctionsList'
import { fromApi, newFunctionAutomation } from './functions/model'
import type { FunctionAutomation } from './functions/model'

export function FunctionsPage() {
  const queryClient = useQueryClient()
  const { data, isPending, isError, refetch, isFetching } = useQuery(
    functionsQueryOptions(),
  )
  const [draft, setDraft] = useState<FunctionAutomation | null>(null)
  const funcs = (data?.items ?? []).map(fromApi)

  const saveMutation = useMutation({
    mutationFn: (fn: FunctionAutomation) =>
      fn.id
        ? updateFunction(fn.id, {
            name: fn.name,
            description: fn.description,
            runtime: fn.runtime,
            trigger: fn.trigger,
            trigger_config: fn.triggerConfig,
            profile: fn.profile,
            enabled: fn.enabled,
            timeout_ms: fn.timeout,
            egress: fn.egress,
            approval: fn.approval,
            code: fn.code,
            secrets: fn.secrets,
          })
        : createFunction({
            name: fn.name,
            description: fn.description,
            runtime: fn.runtime,
            trigger: fn.trigger,
            trigger_config: fn.triggerConfig,
            profile: fn.profile,
            enabled: fn.enabled,
            timeout_ms: fn.timeout,
            egress: fn.egress,
            approval: fn.approval,
            code: fn.code,
            secrets: fn.secrets,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: functionKeys.all })
      notifications.show({ color: 'green', message: 'Function saved' })
      setDraft(null)
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Failed to save function',
      }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      updateFunction(id, { enabled }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: functionKeys.all }),
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error ? error.message : 'Failed to toggle function',
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFunction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: functionKeys.all })
      notifications.show({ message: 'Function deleted' })
      setDraft(null)
    },
  })

  if (draft) {
    return (
      <FunctionEditor
        draft={draft}
        setDraft={(update) => setDraft((c) => (c ? update(c) : c))}
        onBack={() => setDraft(null)}
        onDelete={
          draft.id ? () => deleteMutation.mutate(draft.id) : undefined
        }
        deleting={deleteMutation.isPending}
        onSave={() => {
          if (!draft.name.trim()) {
            notifications.show({
              color: 'red',
              message: 'Function name is required',
            })
            return
          }
          saveMutation.mutate({
            ...draft,
            name: draft.name.trim(),
            description: draft.description.trim(),
          })
        }}
        saving={saveMutation.isPending}
      />
    )
  }

  if (isError) {
    return (
      <Box className={classes.page}>
        <Stack align="center" p="xl">
          <Text c="red.7">Couldn't load functions.</Text>
          <Button
            variant="default"
            loading={isFetching}
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </Stack>
      </Box>
    )
  }

  return (
    <FunctionsList
      functions={funcs}
      onEdit={(fn) => setDraft({ ...fn })}
      onNew={() => setDraft(newFunctionAutomation())}
      onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
      loading={isPending}
    />
  )
}
