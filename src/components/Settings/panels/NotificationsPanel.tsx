import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Stack,
  Switch,
  Text,
  Textarea,
} from '@mantine/core'
import { useState } from 'react'
import {
  notificationRules,
  notifiers,
} from '#/components/Settings/settingsData'
import { notify, Panel } from '#/components/Settings/settingsUi'

export function NotificationsPanel() {
  const [preview, setPreview] = useState('- preview renders here -')
  const template =
    '{{event.action}} - {{entity.id}} {{entity.title}}\nseverity: {{entity.severity}} - org: {{event.org}} - by {{event.actor}}'

  return (
    <Stack gap="md">
      <Panel title="Notification rules">
        <Stack gap={0} p={18} pt={6} pb={6}>
          {notificationRules.map(([name, description, enabled]) => (
            <Group
              key={name}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {name}
                </Text>
                <Text fz={12} c="var(--muted)">
                  {description}
                </Text>
              </Box>
              <Switch defaultChecked={enabled} aria-label={`${name} enabled`} />
            </Group>
          ))}
        </Stack>
      </Panel>

      <Panel
        title="Notifiers"
        count={`${notifiers.filter(([, , enabled]) => enabled).length} active`}
        action={
          <Button
            variant="default"
            onClick={() => notify('Add notifier workflow opened')}
          >
            + Add notifier
          </Button>
        }
      >
        <Stack gap={0} p={18} pt={6} pb={6}>
          {notifiers.map(([type, destination, enabled]) => (
            <Group
              key={destination}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Badge variant="default" color="gray" miw={38}>
                {type.slice(0, 2).toUpperCase()}
              </Badge>
              <Box flex={1}>
                <Text fz={13} fw={700}>
                  {type}
                </Text>
                <Text ff="monospace" fz={11} c="var(--faint)">
                  {destination}
                </Text>
              </Box>
              <Button
                size="xs"
                variant="default"
                onClick={() => notify(`${type} notifier test sent`)}
              >
                Test
              </Button>
              <Switch
                defaultChecked={enabled}
                aria-label={`${type} notifier enabled`}
              />
            </Group>
          ))}
        </Stack>
      </Panel>

      <Panel
        title="Message template"
        count="handlebars"
        action={
          <Button
            variant="default"
            onClick={() =>
              setPreview(
                'case.create - #1842 OAuth consent grant - privileged account compromise\nseverity: HIGH - org: origin-soc - by J. Tanaka',
              )
            }
          >
            Preview with sample event
          </Button>
        }
      >
        <Box p={18}>
          <Textarea
            aria-label="Notification message template"
            rows={4}
            defaultValue={template}
            styles={{ input: { fontFamily: 'monospace' } }}
          />
          <Paper mt="sm" p="sm" bg="gray.0" withBorder>
            <Text
              ff="monospace"
              fz={12}
              c="green.8"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {preview}
            </Text>
          </Paper>
        </Box>
      </Panel>
    </Stack>
  )
}
