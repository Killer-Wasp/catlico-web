import classes from '#/components/Cases/CasesPage.module.css'
import { Box, Group, Tabs, Text, Title } from '@mantine/core'
import { useState } from 'react'
import { ApiKeysPanel } from '#/components/Settings/panels/ApiKeysPanel'
import { AuditLogPanel } from '#/components/Settings/panels/AuditLogPanel'
import { ConnectorsPanel } from '#/components/Settings/panels/ConnectorsPanel'
import { CustomFieldsPanel } from '#/components/Settings/panels/CustomFieldsPanel'
import { IntegrationsPanel } from '#/components/Settings/panels/IntegrationsPanel'
import { NotificationsPanel } from '#/components/Settings/panels/NotificationsPanel'
import { ObservableTypesPanel } from '#/components/Settings/panels/ObservableTypesPanel'
import { OrganisationsPanel } from '#/components/Settings/panels/OrganisationsPanel'
import { OrgProfilePanel } from '#/components/Settings/panels/OrgProfilePanel'
import { ProfilesPanel } from '#/components/Settings/panels/ProfilesPanel'
import { SlaPanel } from '#/components/Settings/panels/SlaPanel'
import { TaxonomiesPanel } from '#/components/Settings/panels/TaxonomiesPanel'
import { UsersPanel } from '#/components/Settings/panels/UsersPanel'
import { settingsSections } from '#/components/Settings/settingsData'
import type { SettingsSection } from '#/components/Settings/settingsData'
import { useStamp } from '#/components/Settings/settingsUi'

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

export function SettingsPage() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>('Organisation')
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
          if (value) setActiveSection(value as SettingsSection)
        }}
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
            <SectionPanel section={activeSection} />
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Box>
  )
}
