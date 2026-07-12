import { Anchor, Button, Stack, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { Panel } from '#/components/pages/settings/settingsUi'

export function IntegrationsPanel() {
  return (
    <Stack gap="md">
      <Panel
        title="Integrations"
        count={0}
        action={
          <Button component={Link} to="/plugins" variant="default">
            Open Plugins
          </Button>
        }
      >
        <Text fz={13} c="dimmed" py={12} px={18}>
          Integrations have moved to the new Plugins system. Manage them on the{' '}
          <Anchor component={Link} to="/plugins">
            Plugins
          </Anchor>{' '}
          page.
        </Text>
      </Panel>
    </Stack>
  )
}
