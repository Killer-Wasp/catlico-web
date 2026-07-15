import { AccountLayout } from '#/components/pages/SettingsPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/account')({
  component: AccountLayout,
})
