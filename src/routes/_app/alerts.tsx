import { AlertsPage } from './-AlertsPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/alerts')({ component: AlertsPage })
