import { Badge, Box, Center, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { publicDashboardQueryOptions } from '#/components/Dashboards/dashboardsQueries'
import { renderWidget } from '#/components/Dashboards/widgets'
import classes from './dashboards/DashboardsPage.module.css'

/**
 * Unauthenticated read-only render of a shared dashboard. Reached at `/d/:token`
 * with no login; fetches the public payload (layout + org-scoped overview) and
 * renders the same widgets as the authenticated board, minus every control.
 */
export function PublicDashboardPage({ token }: { token: string }) {
  const { data, isPending, isError } = useQuery(publicDashboardQueryOptions(token))

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  if (isError || !data) {
    return (
      <Center h="100vh" p="lg">
        <Stack align="center" gap="xs">
          <Title order={3}>Dashboard unavailable</Title>
          <Text c="dimmed" ta="center">
            This share link is invalid or has been revoked.
          </Text>
        </Stack>
      </Center>
    )
  }

  const widgets = data.layout.widgets
  const generatedAt = data.overview.generatedAt

  return (
    <Box p="lg" maw={1400} mx="auto">
      <Group justify="space-between" align="flex-end" mb="md" wrap="nowrap">
        <Stack gap={2}>
          <Title order={2}>{data.name}</Title>
          {data.description && (
            <Text c="dimmed" fz="sm">
              {data.description}
            </Text>
          )}
        </Stack>
        <Group gap="xs" wrap="nowrap">
          <Badge variant="light" color="gray">
            Read-only shared view
          </Badge>
          {generatedAt && (
            <Text c="dimmed" fz="xs">
              as of {new Date(generatedAt).toLocaleString()}
            </Text>
          )}
        </Group>
      </Group>

      {widgets.length === 0 ? (
        <Text c="dimmed">This dashboard has no widgets.</Text>
      ) : (
        <Box className={classes.grid}>
          {widgets.map((w, index) => (
            <Box
              key={`${w.type}-${index}`}
              className={`${classes.cell} ${classes[w.size]}`}
            >
              {renderWidget(w.type, data.overview)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
