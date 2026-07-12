import classes from '#/components/Cases/CasesPage.module.css'
import { Box, Group, Tabs, Text, Title } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { ApiKeysPanel } from './settings/panels/ApiKeysPanel'
import { AttackCatalogPanel } from './settings/panels/AttackCatalogPanel'
import { AuditLogPanel } from './settings/panels/AuditLogPanel'
import { CustomFieldsPanel } from './settings/panels/CustomFieldsPanel'
import { IntegrationsPanel } from './settings/panels/IntegrationsPanel'
import { MyAccountPanel } from './settings/panels/MyAccountPanel'
import { NotificationsPanel } from './settings/panels/NotificationsPanel'
import { ObservableTypesPanel } from './settings/panels/ObservableTypesPanel'
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
import { usePermissions } from '#/lib/auth/usePermissions'

// Read capability required to see a section in the nav. Sections not listed are
// always shown (every built-in role can view them). Server-side enforcement still
// applies regardless — this only trims the nav.
const SECTION_READ_PERMISSION: Partial<Record<SettingsSection, string>> = {
  'Users & roles': 'read:user',
  'Profiles & permissions': 'read:role',
  'Custom fields': 'read:custom_field',
  Notifications: 'read:organisation',
  'SLA policies': 'read:organisation',
  'API keys': 'write:organisation',
  Integrations: 'read:organisation',
}

function SectionPanel({ section }: { section: SettingsSection }) {
  if (section === 'My account') return <MyAccountPanel />
  if (section === 'Users & roles') return <UsersPanel />
  if (section === 'Profiles & permissions') return <ProfilesPanel />
  if (section === 'Custom fields') return <CustomFieldsPanel />
  if (section === 'Observable types') return <ObservableTypesPanel />
  if (section === 'Taxonomies & tags') return <TaxonomiesPanel />
  if (section === 'ATT&CK catalog') return <AttackCatalogPanel />
  if (section === 'Notifications') return <NotificationsPanel />
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
    <SectionPanel
      section={(section && slugToSection(section)) || 'Organisation'}
    />
  )
}

export function SettingsLayout() {
  const { section } = useParams({ strict: false })
  const activeSection: SettingsSection =
    (section && slugToSection(section)) || 'Organisation'
  const navigate = useNavigate()
  const stamp = useStamp()
  const { can, isSuperadmin, isLoaded } = usePermissions()

  // Until effective permissions load, show every section (avoids a flash of an
  // empty nav for admins). Once known, hide sections the user can't read.
  const visibleSections = settingsSections.filter((s) => {
    if (!isLoaded) return true
    if (s === 'Audit log') return isSuperadmin
    const needed = SECTION_READ_PERMISSION[s]
    return needed ? can(needed) : true
  })

  return (
    <ModalsProvider>
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
              {visibleSections.map((settingsSection) => (
                <Tabs.Tab key={settingsSection} value={settingsSection}>
                  {settingsSection}
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
    </ModalsProvider>
  )
}
