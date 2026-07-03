import classes from '#/components/Cases/CasesPage.module.css'
import { Box, Group, Tabs, Text, Title } from '@mantine/core'
import { Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { ApiKeysPanel } from './settings/panels/ApiKeysPanel'
import { AuditLogPanel } from './settings/panels/AuditLogPanel'
import { ConnectorsPanel } from './settings/panels/ConnectorsPanel'
import { CustomFieldsPanel } from './settings/panels/CustomFieldsPanel'
import { IntegrationsPanel } from './settings/panels/IntegrationsPanel'
import { NotificationsPanel } from './settings/panels/NotificationsPanel'
import { ObservableTypesPanel } from './settings/panels/ObservableTypesPanel'
import { OrganisationsPanel } from './settings/panels/OrganisationsPanel'
import { OrgProfilePanel } from './settings/panels/OrgProfilePanel'
import { ProfilesPanel } from './settings/panels/ProfilesPanel'
import { SlaPanel } from './settings/panels/SlaPanel'
import { TaxonomiesPanel } from './settings/panels/TaxonomiesPanel'
import { UsersPanel } from './settings/panels/UsersPanel'
import {
  sectionToSlug,
  settingsSections,
  slugToSection,
} from './settings/settingsData'
import type { SettingsSection } from './settings/settingsData'
import { useStamp } from './settings/settingsUi'

function SectionPanel({ section }: { section: SettingsSection }) {
  if (section === 'Organisations') return <OrganisationsPanel />
  if (section === 'Users & roles') return <UsersPanel />
  if (section === 'Profiles & permissions') return <ProfilesPanel />
  if (section === 'Custom fields') return <CustomFieldsPanel />
  if (section === 'Observable types') return <ObservableTypesPanel />
  if (section === 'Taxonomies & tags') return <TaxonomiesPanel />
  if (section === 'Notifications') return <NotificationsPanel />
  if (section === 'Connectors') return <ConnectorsPanel />
  if (section === 'SLA policies') return <SlaPanel />
  if (section === 'API keys') return <ApiKeysPanel />
  if (section === 'Integrations') return <IntegrationsPanel />
  if (section === 'Audit log') return <AuditLogPanel />
  return <OrgProfilePanel />
}

// Rendered by the `/settings/$section` child route into the layout's Outlet.
export function SettingsSectionPanel() {
  const { section } = useParams({ strict: false })
  return (
    <SectionPanel section={(section && slugToSection(section)) || 'Organisation'} />
  )
}

export function SettingsLayout() {
  const { section } = useParams({ strict: false })
  const activeSection: SettingsSection =
    (section && slugToSection(section)) || 'Organisation'
  const navigate = useNavigate()
  const stamp = useStamp()

  return (
    <Box className={classes.page}>
      <Group align="baseline" gap={16} mb={26} wrap="wrap">
        <Title order={1}>Settings</Title>
        <Text ff="monospace" fz={12} c="var(--faint)">
          {stamp}
        </Text>
      </Group>

      <Tabs
        variant="pills"
        orientation="vertical"
        value={activeSection}
        onChange={(value) => {
          if (value)
            navigate({
              to: '/settings/$section',
              params: { section: sectionToSlug(value as SettingsSection) },
            })
        }}
        styles={{ tabLabel: { textAlign: 'left' } }}
      >
        <Box
          component="nav"
          aria-label="Settings sections"
          w={220}
          style={{ position: 'sticky', top: 84, alignSelf: 'flex-start' }}
        >
          <Tabs.List>
            {settingsSections.map((section) => (
              <Tabs.Tab key={section} value={section}>
                {section}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Box>

        <Box miw={0} style={{ flex: 1 }}>
          <Tabs.Panel value={activeSection} pl="md">
            <Outlet />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Box>
  )
}
