import { Stack, Text } from '@mantine/core'
import { Panel } from '#/components/pages/settings/settingsUi'

export function ConnectorsPanel() {
  return (
    <Stack gap="md">
      <Panel title="Connectors" count={0}>
        <Text fz={13} c="dimmed" py={12} px={18}>
          Connectors have been replaced by the new Plugins system. Visit the
          Plugins page to manage integrations.
        </Text>
      </Panel>
    </Stack>
  )
}
