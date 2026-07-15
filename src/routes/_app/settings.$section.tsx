import { SettingsSectionPanel } from '#/components/pages/SettingsPage'
import {
  appSettingsSections,
  sectionToSlug,
} from '#/components/pages/settings/settingsData'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/settings/$section')({
  beforeLoad: ({ params }) => {
    // Only sections that belong to the Settings page are valid here; anything
    // else (an Account/Admin slug, or garbage) redirects to the default tab.
    const known = appSettingsSections.some(
      (s) => sectionToSlug(s) === params.section,
    )
    if (!known) {
      throw redirect({
        to: '/settings/$section',
        params: { section: 'organisation' },
      })
    }
  },
  component: SettingsSectionPanel,
})
