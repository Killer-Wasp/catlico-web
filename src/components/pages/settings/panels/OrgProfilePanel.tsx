import {
  Box,
  Button,
  Group,
  Select,
  SimpleGrid,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  organisationProfileQueryOptions,
  settingsKeys,
  updateOrganisationProfile,
} from '#/components/pages/settings/settingsQueries'
import {
  ErrorPanel,
  LoadingPanel,
  notifyError,
  notifySuccess,
  Panel,
} from '#/components/pages/settings/settingsUi'

const FALLBACK_TIMEZONES = [
  'UTC',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
]

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
  const browserTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  )
  const timezoneOptions = useMemo(() => {
    const supported =
      typeof Intl.supportedValuesOf === 'function'
        ? Intl.supportedValuesOf('timeZone')
        : FALLBACK_TIMEZONES
    // Include the org's stored timezone so the Select never renders blank when the
    // browser doesn't enumerate that value.
    return Array.from(
      new Set(
        [org?.timezone, browserTz, ...supported, ...FALLBACK_TIMEZONES].filter(
          Boolean,
        ) as string[],
      ),
    )
  }, [browserTz, org?.timezone])
  const [timezone, setTimezone] = useState(browserTz)
  const [defaultTlp, setDefaultTlp] = useState(2)

  useEffect(() => {
    if (!org) return
    setName(org.name)
    setDescription(org.description)
    setTimezone(org.timezone)
    setDefaultTlp(org.default_tlp)
  }, [org])

  const saveMutation = useMutation({
    mutationFn: () =>
      updateOrganisationProfile({
        name,
        description,
        timezone,
        default_tlp: defaultTlp,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(settingsKeys.organisation(updated.id), updated)
      // Propagate the rename to the org list / switcher, which key off separate
      // queries and would otherwise keep showing the stale name.
      queryClient.invalidateQueries({ queryKey: settingsKeys.organisations() })
      queryClient.invalidateQueries({
        queryKey: settingsKeys.accessibleOrganisations(),
      })
      notifySuccess('Organisation profile saved')
    },
    onError: (error) => notifyError(error, 'Unable to save organisation'),
  })

  const dirty =
    !!org &&
    (name !== org.name ||
      description !== org.description ||
      timezone !== org.timezone ||
      defaultTlp !== org.default_tlp)

  if (isPending) return <LoadingPanel label="Loading organisation profile..." />

  if (isError) {
    return (
      <ErrorPanel
        label="Couldn’t load organisation settings."
        onRetry={() => refetch()}
        retrying={isFetching}
      />
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
            label="Organisation ID"
            value={org.id}
            readOnly
            styles={{ input: { fontFamily: 'monospace', fontWeight: 600 } }}
          />
          <Textarea
            label="Organisation description"
            value={description}
            minRows={2}
            style={{ gridColumn: '1 / -1' }}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          <Select
            label="Timezone"
            data={timezoneOptions}
            value={timezone}
            onChange={(v) => setTimezone(v ?? browserTz)}
            allowDeselect={false}
          />
          <Select
            label="Default case TLP"
            data={[
              { value: '2', label: 'TLP:AMBER' },
              { value: '1', label: 'TLP:GREEN' },
              { value: '3', label: 'TLP:RED' },
            ]}
            value={String(defaultTlp)}
            onChange={(v) => setDefaultTlp(Number(v))}
            allowDeselect={false}
          />
        </SimpleGrid>

        <Group justify="flex-end" mt="md">
          <Button
            color="orange"
            loading={saveMutation.isPending}
            disabled={!dirty}
            onClick={() => saveMutation.mutate()}
          >
            Save changes
          </Button>
        </Group>
      </Box>
    </Panel>
  )
}
