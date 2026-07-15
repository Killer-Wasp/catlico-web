import { AdminSectionPanel } from '#/components/pages/SettingsPage'
import {
  adminSections,
  sectionToSlug,
} from '#/components/pages/settings/settingsData'
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/admin/$section')({
  beforeLoad: ({ params }) => {
    const known = adminSections.some((s) => sectionToSlug(s) === params.section)
    if (!known) {
      throw redirect({ to: '/admin/$section', params: { section: 'users' } })
    }
  },
  component: AdminSectionPanel,
})
