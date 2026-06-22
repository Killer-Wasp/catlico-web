import {
  Box,
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  organisationProfileQueryOptions,
  settingsKeys,
  updateOrganisationProfile,
} from '#/components/Settings/settingsQueries'
import { LoadingPanel, Panel } from '#/components/Settings/settingsUi'

export function OrgProfilePanel() {
  const queryClient = useQueryClient()
  const {
    data: org,
    isPending,
    isError,
    refetch,
    isFetching,
  } = useQuery(organisationProfileQueryOptions())
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!org) return
    setName(org.name)
    setDescription(org.description)
  }, [org])

  const saveMutation = useMutation({
    mutationFn: () => updateOrganisationProfile({ name, description }),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKeys.organisation(updated.id), updated)
      notifications.show({
        color: 'green',
        message: 'Organisation profile saved',
      })
    },
    onError: (error) =>
      notifications.show({
        color: 'red',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to save organisation',
      }),
  })

  if (isPending) return <LoadingPanel label="Loading organisation profile..." />

  if (isError) {
    return (
      <Panel title="Organisation profile">
        <Stack align="center" p="xl">
          <Text c="red.7">Couldn’t load organisation settings.</Text>
          <Button
            variant="default"
            loading={isFetching}
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </Stack>
      </Panel>
    )
  }

  return (
    <Panel title="Organisation profile">
      <Box p={18}>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={18} verticalSpacing={16}>
          <TextInput
            label="Organisation name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <TextInput
            label="Org short name"
            value={org.id}
            readOnly
            styles={{ input: { fontFamily: 'monospace', fontWeight: 600 } }}
          />
          <Textarea
            label="Organisation description"
            value={description}
            minRows={2}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          <Select
            label="Timezone"
            data={['Australia/Sydney (AEST)', 'UTC']}
            defaultValue="Australia/Sydney (AEST)"
            allowDeselect={false}
          />
          <Select
            label="Default case TLP"
            data={['TLP:AMBER', 'TLP:GREEN', 'TLP:RED']}
            defaultValue="TLP:AMBER"
            allowDeselect={false}
          />
        </SimpleGrid>

        <Group justify="flex-end" mt="md">
          <Button
            color="orange"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save changes
          </Button>
        </Group>
      </Box>
    </Panel>
  )
}
