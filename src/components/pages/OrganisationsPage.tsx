import classes from '#/components/Cases/CasesPage.module.css'
import { Box, Group, Text, Title } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { OrganisationsPanel } from './settings/panels/OrganisationsPanel'
import { useStamp } from './settings/settingsUi'

// Superadmin-only page. Access is gated by the `/organisations` route guard
// (see routes/_app/organisations.tsx) and the account menu only surfaces the
// link for superadmins; the backend also enforces platform-admin access.
export function OrganisationsPage() {
  const stamp = useStamp()

  return (
    <ModalsProvider>
      <Box className={classes.page}>
        <Group align="baseline" gap={16} mb={26} wrap="wrap">
          <Title order={1}>Organisations</Title>
          <Text ff="monospace" fz={12} c="var(--faint)">
            {stamp}
          </Text>
        </Group>

        <OrganisationsPanel />
      </Box>
    </ModalsProvider>
  )
}
