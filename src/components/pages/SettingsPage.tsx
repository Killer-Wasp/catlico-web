import classes from '#/components/Cases/CasesPage.module.css'
import { Box, Group, Tabs, Text, Title } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Outlet, useNavigate, useParams } from '@tanstack/react-router'
import { ApiKeysPanel } from './settings/panels/ApiKeysPanel'
import { AttackCatalogPanel } from './settings/panels/AttackCatalogPanel'
import { CustomFieldsPanel } from './settings/panels/CustomFieldsPanel'
import { IdentityProvidersPanel } from './settings/panels/IdentityProvidersPanel'
import { IntegrationsPanel } from './settings/panels/IntegrationsPanel'
import { MfaSettingsPanel } from './settings/panels/MfaSettingsPanel'
import { MyAccountPanel } from './settings/panels/MyAccountPanel'
import { NotificationsPanel } from './settings/panels/NotificationsPanel'
import { ObservableTypesPanel } from './settings/panels/ObservableTypesPanel'
import { OrgProfilePanel } from './settings/panels/OrgProfilePanel'
import { ProfilesPanel } from './settings/panels/ProfilesPanel'
import { ReportTemplatesPanel } from './settings/panels/ReportTemplatesPanel'
import { SecurityPanel } from './settings/panels/SecurityPanel'
import { SlaPanel } from './settings/panels/SlaPanel'
import { TaxonomiesPanel } from './settings/panels/TaxonomiesPanel'
import { UsersPanel } from './settings/panels/UsersPanel'
import {
  accountSections,
  adminSections,
  appSettingsSections,
  sectionToSlug,
  slugToSection,
} from './settings/settingsData'
import type { SettingsSection } from './settings/settingsData'
import { useStamp } from './settings/settingsUi'
import { usePermissions } from '#/lib/auth/usePermissions'
import { useQuery } from '@tanstack/react-query'
import { systemCapabilitiesQueryOptions } from '#/lib/system/capabilities'

// Read capability required to see a section in the nav. Sections not listed are
// always shown (every built-in role can view them). Server-side enforcement still
// applies regardless — this only trims the nav.
const SECTION_READ_PERMISSION: Partial<Record<SettingsSection, string>> = {
  Users: 'read:user',
  Roles: 'read:role',
  'Custom fields': 'read:custom_field',
  Notifications: 'read:organisation',
  'SLA policies': 'read:organisation',
  'API keys': 'write:organisation',
  Integrations: 'read:organisation',
  'Report templates': 'write:organisation',
}

function SectionPanel({ section }: { section: SettingsSection }) {
  if (section === 'My account') return <MyAccountPanel />
  if (section === 'Security') return <SecurityPanel />
  if (section === 'Users') return <UsersPanel />
  if (section === 'Roles') return <ProfilesPanel />
  if (section === 'Custom fields') return <CustomFieldsPanel />
  if (section === 'Observable types') return <ObservableTypesPanel />
  if (section === 'Taxonomies & tags') return <TaxonomiesPanel />
  if (section === 'ATT&CK catalog') return <AttackCatalogPanel />
  if (section === 'Notifications') return <NotificationsPanel />
  if (section === 'SLA policies') return <SlaPanel />
  if (section === 'API keys') return <ApiKeysPanel />
  if (section === 'Integrations') return <IntegrationsPanel />
  if (section === 'Report templates') return <ReportTemplatesPanel />
  if (section === 'Identity providers') return <IdentityProvidersPanel />
  if (section === 'MFA policy') return <MfaSettingsPanel />
  return <OrgProfilePanel />
}

// Route param → section for the child `$section` panel, defaulting to the page's
// first section. Shared by all three pages' `$section` routes.
function useActiveSection(defaultSection: SettingsSection): SettingsSection {
  const { section } = useParams({ strict: false })
  return (section && slugToSection(section)) || defaultSection
}

function SectionRoutePanel({ defaultSection }: { defaultSection: SettingsSection }) {
  const active = useActiveSection(defaultSection)
  return <SectionPanel section={active} />
}

export const SettingsSectionPanel = () => (
  <SectionRoutePanel defaultSection="Organisation" />
)
export const AccountSectionPanel = () => (
  <SectionRoutePanel defaultSection="My account" />
)
export const AdminSectionPanel = () => (
  <SectionRoutePanel defaultSection="Users" />
)

/**
 * Generic settings-style page: a title, a sticky vertical pill-tab rail of
 * `sections`, and an `Outlet` for the active section's panel. Reused by the
 * Settings, Account and Admin pages (each passes its own section list + route).
 */
function SectionLayout({
  title,
  sections,
  to,
  defaultSection,
}: {
  title: string
  sections: SettingsSection[]
  to: '/settings/$section' | '/account/$section' | '/admin/$section'
  defaultSection: SettingsSection
}) {
  const activeSection = useActiveSection(defaultSection)
  const navigate = useNavigate()
  const stamp = useStamp()
  const { can, isSuperadmin, isLoaded } = usePermissions()
  const { data: capabilities } = useQuery(systemCapabilitiesQueryOptions())

  // Until effective permissions load, show every section (avoids a flash of an
  // empty nav for admins). Once known, hide sections the user can't read.
  const visibleSections = sections.filter((s) => {
    if (!isLoaded) return true
    // Identity providers is a platform-admin surface.
    if (s === 'Identity providers') return isSuperadmin
    // The org-wide MFA policy is a superadmin surface AND only exists on builds
    // that report the MFA capability (hidden on the OSS default).
    if (s === 'MFA policy') return isSuperadmin && capabilities?.mfa === true
    const needed = SECTION_READ_PERMISSION[s]
    return needed ? can(needed) : true
  })

  return (
    <ModalsProvider>
      <Box className={classes.page}>
        <Group align="baseline" gap={16} mb={26} wrap="wrap">
          <Title order={1}>{title}</Title>
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
                to,
                params: { section: sectionToSlug(value as SettingsSection) },
              })
          }}
          styles={{ tabLabel: { textAlign: 'left' } }}
        >
          <Box
            component="nav"
            aria-label={`${title} sections`}
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

export function SettingsLayout() {
  return (
    <SectionLayout
      title="Settings"
      sections={appSettingsSections}
      to="/settings/$section"
      defaultSection="Organisation"
    />
  )
}

export function AccountLayout() {
  return (
    <SectionLayout
      title="Account"
      sections={accountSections}
      to="/account/$section"
      defaultSection="My account"
    />
  )
}

export function AdminLayout() {
  return (
    <SectionLayout
      title="Admin"
      sections={adminSections}
      to="/admin/$section"
      defaultSection="Users"
    />
  )
}
