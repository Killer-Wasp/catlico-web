import { Badge, Box, Button, Group, Stack, Switch, Text } from '@mantine/core'
import { freetags, taxonomies } from '#/components/Settings/settingsData'
import { notify, Panel } from '#/components/Settings/settingsUi'

export function TaxonomiesPanel() {
  return (
    <Stack gap="md">
      <Panel
        title="Taxonomies"
        count={`${taxonomies.filter(([, , , enabled]) => enabled).length} enabled`}
        action={
          <Button
            variant="default"
            onClick={() => notify('MISP taxonomy import opened')}
          >
            Import MISP taxonomy
          </Button>
        }
      >
        <Stack gap={0} p={18} pt={6} pb={6}>
          {taxonomies.map(([namespace, version, predicates, enabled]) => (
            <Group
              key={namespace}
              py={12}
              style={{ borderBottom: '1px solid var(--line-soft)' }}
            >
              <Box flex={1}>
                <Text ff="monospace" fz={13} fw={700}>
                  {namespace}
                </Text>
                <Text fz={12} c="var(--muted)">
                  v{version} - {predicates}
                </Text>
              </Box>
              <Switch
                defaultChecked={enabled}
                aria-label={`${namespace} enabled`}
              />
            </Group>
          ))}
        </Stack>
      </Panel>

      <Panel title="Org freetags" count={freetags.length}>
        <Group gap={6} p={18}>
          {freetags.map((tag) => (
            <Badge key={tag} variant="default" color="gray" ff="monospace">
              {tag}
            </Badge>
          ))}
          <Button
            size="xs"
            variant="default"
            onClick={() => notify('Add freetag workflow opened')}
          >
            + add
          </Button>
        </Group>
      </Panel>
    </Stack>
  )
}
