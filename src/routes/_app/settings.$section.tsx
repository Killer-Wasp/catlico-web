import { SettingsSectionPanel } from '#/components/pages/SettingsPage'
import { slugToSection } from '#/components/pages/settings/settingsData'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings/$section')({
  beforeLoad: ({ params }) => {
    if (!slugToSection(params.section)) {
      throw redirect({
        to: '/settings/$section',
        params: { section: 'organisation' },
      })
    }
  },
  component: SettingsSectionPanel,
})
