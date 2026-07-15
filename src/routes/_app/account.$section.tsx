import { AccountSectionPanel } from '#/components/pages/SettingsPage'
import {
  accountSections,
  sectionToSlug,
} from '#/components/pages/settings/settingsData'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account/$section')({
  beforeLoad: ({ params }) => {
    const known = accountSections.some(
      (s) => sectionToSlug(s) === params.section,
    )
    if (!known) {
      throw redirect({
        to: '/account/$section',
        params: { section: 'my-account' },
      })
    }
  },
  component: AccountSectionPanel,
})
