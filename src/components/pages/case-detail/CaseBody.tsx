import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { Group, Paper, Stack, Tabs, Text } from '@mantine/core'
import { Link, Outlet, useLocation } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { AttachmentsPanel } from './AttachmentsPanel'
import { CasePanelHeader } from './CasePanelHeader'
import { CASE_TABS } from './constants'
import type { CaseTab } from './constants'
import { CommentsPanel } from './CommentsPanel'
import { CustomFieldsPanel } from './CustomFieldsPanel'
import { DetailsPanel } from './DetailsPanel'
import { ObservablesPanel } from './ObservablesPanel'
import { TasksPanel } from './TasksPanel'
import { TimelinePanel } from './TimelinePanel'

export function CaseBody({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const lastSegment = useLocation({
    select: (location) => location.pathname.split('/').filter(Boolean).pop(),
  })
  const activeTab: CaseTab = CASE_TABS.includes(lastSegment as CaseTab)
    ? (lastSegment as CaseTab)
    : 'details'

  const tabDefs: { value: CaseTab; label: string }[] = [
    { value: 'details', label: 'Details' },
    {
      value: 'custom-fields',
      label: `Custom fields ${caseDetail.customFields.length}`,
    },
    { value: 'tasks', label: `Tasks ${caseDetail.tasks.length}` },
    {
      value: 'observables',
      label: `Observables ${caseDetail.observables.length}`,
    },
    { value: 'comments', label: `Comments ${caseDetail.comments.length}` },
    {
      value: 'attachments',
      label: `Attachments ${caseDetail.attachments.length}`,
    },
    { value: 'timeline', label: 'Timeline' },
    { value: 'sharing', label: `Sharing ${caseDetail.shares}` },
  ]

  return (
    <Paper radius="md" withBorder>
      <Tabs value={activeTab} color="orange">
        <Tabs.List px="md">
          {tabDefs.map(({ value, label }) => (
            <Tabs.Tab
              key={value}
              value={value}
              p="md"
              renderRoot={(props) => (
                <Link
                  to="/cases/$caseId/$tab"
                  params={{ caseId, tab: value }}
                  {...props}
                />
              )}
            >
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Outlet />
    </Paper>
  )
}

/** Renders the panel for the active case tab (driven by the URL segment). */
export function CaseTabPanel({
  tab,
  caseDetail,
  caseId,
}: {
  tab: CaseTab
  caseDetail: CaseDetail
  caseId: string
}) {
  switch (tab) {
    case 'custom-fields':
      return <CustomFieldsPanel customFields={caseDetail.customFields} />
    case 'tasks':
      return <TasksPanel caseDetail={caseDetail} caseId={caseId} />
    case 'observables':
      return <ObservablesPanel caseDetail={caseDetail} caseId={caseId} />
    case 'comments':
      return <CommentsPanel caseId={caseId} />
    case 'attachments':
      return (
        <AttachmentsPanel
          attachments={caseDetail.attachments}
          caseId={caseId}
        />
      )
    case 'timeline':
      return <TimelinePanel timeline={caseDetail.timeline} caseId={caseId} />
    case 'sharing':
      return (
        <EmptyTab
          icon={<ShieldCheck size={18} />}
          title="Sharing"
          label={`${caseDetail.shares} external sharing entries are active.`}
        />
      )
    case 'details':
    default:
      return <DetailsPanel caseDetail={caseDetail} caseId={caseId} />
  }
}

function EmptyTab({
  icon,
  label,
  title,
}: {
  icon: ReactNode
  label: string
  title: string
}) {
  return (
    <Stack gap="md" p="lg">
      <CasePanelHeader label={title} />
      <Group justify="center" c="dimmed" gap="xs" py={60}>
        {icon}
        <Text fz={14}>{label}</Text>
      </Group>
    </Stack>
  )
}
