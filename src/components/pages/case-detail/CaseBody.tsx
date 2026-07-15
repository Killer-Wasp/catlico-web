import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import { caseCountsQueryOptions } from '#/components/Cases/casesQueries'
import { Badge, Group, Paper, Stack, Tabs, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
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
import { SimilarCasesPanel } from './SimilarCasesPanel'
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

  // Badge counts come from the lightweight counts endpoint, not from
  // materialising each section's full list. Undefined while loading ⇒ no badge.
  const { data: counts } = useQuery(caseCountsQueryOptions(caseId))

  const tabDefs: { value: CaseTab; label: string; count?: number }[] = [
    { value: 'details', label: 'Details' },
    {
      value: 'custom-fields',
      label: 'Custom fields',
      count: counts?.customFields,
    },
    { value: 'tasks', label: 'Tasks', count: counts?.tasks },
    {
      value: 'observables',
      label: 'Observables',
      count: counts?.observables,
    },
    { value: 'comments', label: 'Comments', count: counts?.comments },
    {
      value: 'attachments',
      label: 'Attachments',
      count: counts?.attachments,
    },
    { value: 'similar', label: 'Similar', count: counts?.similar },
    { value: 'timeline', label: 'Timeline' },
    { value: 'sharing', label: 'Sharing', count: caseDetail.shares },
  ]

  return (
    <Paper radius="md" withBorder>
      <Tabs value={activeTab} color="orange">
        <Tabs.List px="md">
          {tabDefs.map(({ value, label, count }) => (
            <Tabs.Tab
              key={value}
              value={value}
              p="md"
              rightSection={
                count === undefined ? undefined : (
                  <Badge variant="default" color="gray" radius="xl" size="sm">
                    {count}
                  </Badge>
                )
              }
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
  highlightCommentId,
}: {
  tab: CaseTab
  caseDetail: CaseDetail
  caseId: string
  /** Forwarded to the comments tab for `?comment=` deep-link scroll+highlight. */
  highlightCommentId?: string
}) {
  switch (tab) {
    case 'custom-fields':
      return <CustomFieldsPanel entityType="case" entityId={caseId} />
    case 'tasks':
      return <TasksPanel caseDetail={caseDetail} caseId={caseId} />
    case 'observables':
      return <ObservablesPanel caseDetail={caseDetail} caseId={caseId} />
    case 'comments':
      return (
        <CommentsPanel caseId={caseId} highlightCommentId={highlightCommentId} />
      )
    case 'attachments':
      return <AttachmentsPanel caseId={caseId} />
    case 'similar':
      return <SimilarCasesPanel caseId={caseId} />
    case 'timeline':
      return <TimelinePanel caseId={caseId} />
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
