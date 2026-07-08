import type { Alert, AlertSimilarCase } from '#/components/Alerts/alerts.types'
import type {
  AlertComment,
  AlertObservableRow,
} from '#/components/Alerts/alertsQueries'
import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
import { fmtRelativeTime } from '#/components/Alerts/alerts'
import { SEV, TLP, TLP_COLOR } from '#/lib/domain'
import { Severity } from '#/components/Severity/Severity'
import { Tag } from '#/components/Tag/Tag'
import { TagPickerInput } from '#/components/Tag/TagPickerInput'
import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  ActionIcon,
  Menu,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  VisuallyHidden,
} from '@mantine/core'
import { useNavigate } from '@tanstack/react-router'
import { ExternalLink, MoreHorizontal, Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from './styles.module.css'

export function AlertDetailDrawer({
  alert,
  caseTemplates = [],
  comments,
  onClose,
  onAddComment,
  onDismiss,
  onMergeIntoCase,
  onRunAnalysis,
  onPromote,
  promotionPending = false,
  onSaveTags,
  savingTags = false,
  hideActions = false,
  tags,
  observables,
  similarCases,
  linkedCases,
}: {
  alert: Alert | null
  caseTemplates?: CaseTemplate[]
  comments: AlertComment[]
  tags?: string[]
  onClose: () => void
  onAddComment: (id: string, note: string) => void
  onDismiss?: (id: string) => void
  onMergeIntoCase?: (id: string) => void
  onRunAnalysis: (id: string) => void
  onPromote?: (id: string, templateId: string) => void
  promotionPending?: boolean
  onSaveTags?: (id: string, tags: string[]) => Promise<unknown> | void
  savingTags?: boolean
  /** Hide the promote/dismiss/merge actions — e.g. when viewing an alert
   *  already linked to a case. */
  hideActions?: boolean
  /** When provided, the Observables section renders these as a table (the
   *  alert-detail endpoint's real observables) instead of `alert.observables`. */
  observables?: AlertObservableRow[]
  /** When provided, overrides `alert.similarCases` with cases fetched from the
   *  API (those sharing an observable with the alert). */
  similarCases?: AlertSimilarCase[]
  /** Cases the alert is directly linked to (via `Alert.case_id`), fetched from
   *  the API — rendered as "Linked case", symmetric to a case's linked alerts. */
  linkedCases?: AlertSimilarCase[]
}) {
  const [note, setNote] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [editingTags, setEditingTags] = useState(false)
  const [draftTags, setDraftTags] = useState<string[]>([])

  useEffect(() => {
    if (!templateId && caseTemplates.length > 0) {
      setTemplateId(caseTemplates[0].id)
    }
  }, [caseTemplates, templateId])

  useEffect(() => {
    if (!alert) return
    setEditingTags(false)
    setDraftTags(tags ?? alert.tags)
  }, [alert, tags])

  const navigate = useNavigate()

  const selectedTemplate =
    caseTemplates.find((template) => template.id === templateId) ??
    (caseTemplates.length > 0 ? caseTemplates[0] : undefined)

  const close = () => {
    setNote('')
    onClose()
  }

  const openCase = (id: string) => {
    close()
    void navigate({
      to: '/cases/$caseId/$tab',
      params: { caseId: id.replace(/^#/, ''), tab: 'details' },
    })
  }

  if (!alert) return null

  const tlpName = TLP[alert.tlp]
  const reference = `${alert.src.toLowerCase().replace(/\s+/g, '-')}:${alert.id.toLowerCase()}`
  const displayedTags = tags ?? alert.tags
  const tagSuggestions = [
    ...new Set([
      ...displayedTags,
      ...caseTemplates.flatMap((template) => template.tags),
    ]),
  ]
  const similarRows = similarCases ?? alert.similarCases
  const linkedRows = linkedCases ?? []
  const startEditingTags = () => {
    setDraftTags(displayedTags)
    setEditingTags(true)
  }
  const saveTags = async () => {
    await onSaveTags?.(alert.id, draftTags)
    setEditingTags(false)
  }
  const dismiss = () => {
    onDismiss?.(alert.id)
    close()
  }
  const mergeIntoCase = () => {
    onMergeIntoCase?.(alert.id)
    close()
  }
  const createCaseWithTemplate = () => {
    onPromote?.(alert.id, templateId)
    close()
  }

  return (
    <Drawer
      opened
      onClose={close}
      position="right"
      size="min(520px, 94vw)"
      padding={0}
      title={<VisuallyHidden>Alert detail</VisuallyHidden>}
      aria-label="Alert detail"
      closeButtonProps={{ 'aria-label': 'Close alert detail' }}
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
      styles={{
        content: { borderLeft: '1px solid var(--line-soft)' },
        header: {
          alignItems: 'flex-start',
          borderBottom: '1px solid var(--line-soft)',
          padding: '18px 22px 0',
        },
        body: { padding: 0 },
      }}
    >
      <Box
        style={{
          borderLeft: `4px solid var(--sev-${SEV[alert.sev]})`,
          marginTop: -44,
          paddingTop: 44,
        }}
      >
        <Box px={22} pb={16}>
          <Text ff="monospace" fz={11} c="dimmed" mb={6}>
            ALERT {alert.id}
          </Text>
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <Text fw={700} fz={18} lh={1.25} style={{ flex: 1 }}>
              {alert.title}
            </Text>
            {!hideActions && (
              <Menu position="bottom-end" withinPortal>
                <Menu.Target>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={`Alert actions for ${alert.id}`}
                  >
                    <MoreHorizontal size={18} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={dismiss}>Dismiss</Menu.Item>
                  <Menu.Item onClick={mergeIntoCase}>
                    Merge into case...
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
          <Stack gap="xs" mt={12}>
            {editingTags ? (
              <Stack gap="xs">
                <Box>
                  <TagPickerInput
                    label="Tags"
                    placeholder="e.g. certificate, hygiene"
                    suggestions={tagSuggestions}
                    value={draftTags}
                    onChange={setDraftTags}
                  />
                </Box>
                <Group justify="flex-end">
                  <Button size="xs" loading={savingTags} onClick={saveTags}>
                    Save tags
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Group gap={6} wrap="wrap" data-testid="alert-drawer-tags">
                {displayedTags.map((tag) => (
                  <Tag key={tag} label={tag} />
                ))}
                {onSaveTags && (
                  <button
                    type="button"
                    className={styles.addTagButton}
                    onClick={startEditingTags}
                  >
                    + add tag
                  </button>
                )}
              </Group>
            )}
            <Group gap={7} wrap="wrap">
              <Badge color="red" variant="light" radius="sm" ff="monospace">
                {SEV[alert.sev].toUpperCase()}
              </Badge>
              <Badge
                color={TLP_COLOR[tlpName]}
                variant="light"
                radius="sm"
                ff="monospace"
              >
                TLP:{tlpName.toUpperCase()}
              </Badge>
            </Group>
          </Stack>
        </Box>

        <DrawerSection title="Details">
          <KeyValue label="Source">{alert.src}</KeyValue>
          <KeyValue label="First seen">
            {fmtRelativeTime(alert.firstSeenAt, alert.ageMin)}
          </KeyValue>
          <KeyValue label="SLA">
            <Text component="span" c={alert.breach ? 'red.6' : 'green.7'}>
              {alert.breach ? 'breached' : 'within SLA'}
            </Text>
          </KeyValue>
          <KeyValue label="Status">Read</KeyValue>
          <KeyValue label="Reference">
            <Text component="span" ff="monospace" fz={12}>
              {reference}
            </Text>
          </KeyValue>
        </DrawerSection>

        <DrawerSection title="Description">
          <Text fz={14} lh={1.45} c="var(--text)">
            {alert.description}
          </Text>
        </DrawerSection>

        <DrawerSection
          title="Observables"
          count={(observables ?? alert.observables).length}
          action={
            <Button
              size="xs"
              variant="default"
              leftSection={<Play size={12} />}
              onClick={() => onRunAnalysis(alert.id)}
            >
              Run analyzers
            </Button>
          }
        >
          {observables ? (
            <ObservableTable rows={observables} />
          ) : (
            <Stack gap={0}>
              {alert.observables.map((observable) => (
                <Group
                  key={`${observable.type}:${observable.value}`}
                  py={7}
                  gap={10}
                  wrap="nowrap"
                  style={{ borderBottom: '1px solid var(--line-soft)' }}
                >
                  <Badge
                    variant="outline"
                    color="gray"
                    radius="sm"
                    ff="monospace"
                  >
                    {observable.type}
                  </Badge>
                  <Text fz={13} ff="monospace" truncate>
                    {observable.value}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </DrawerSection>

        {linkedRows.length > 0 && (
          <DrawerSection title="Linked case" count={linkedRows.length}>
            <SimilarCaseTable rows={linkedRows} onOpen={openCase} />
          </DrawerSection>
        )}

        <DrawerSection title="Similar cases" count={similarRows.length}>
          <SimilarCaseTable rows={similarRows} onOpen={openCase} />
        </DrawerSection>

        <DrawerSection title="Comments" count={comments.length}>
          <Stack gap="md">
            {comments.length ? (
              <Stack gap="xs" className={styles.commentList}>
                {comments.map((comment) => (
                  <Box key={comment.id} className={styles.commentItem}>
                    <Group
                      justify="space-between"
                      align="baseline"
                      gap="sm"
                      wrap="nowrap"
                      className={styles.commentMeta}
                    >
                      <Text className={styles.commentAuthor}>
                        {comment.author}
                      </Text>
                      <Text className={styles.commentTime}>{comment.time}</Text>
                    </Group>
                    <Text className={styles.commentBody}>{comment.body}</Text>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Text className={styles.emptyCommentText}>
                No triage notes yet. They transfer to the case on promotion.
              </Text>
            )}
            <Textarea
              className={styles.commentComposer}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              placeholder="Triage note... transfers to the case on promotion (Ctrl+Enter)"
              minRows={3}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  onAddComment(alert.id, note)
                  setNote('')
                }
              }}
            />
            <Group justify="flex-end">
              <Button
                className={styles.commentSubmit}
                size="xs"
                variant="default"
                onClick={() => {
                  onAddComment(alert.id, note)
                  setNote('')
                }}
              >
                Post note
              </Button>
            </Group>
          </Stack>
        </DrawerSection>

        {!hideActions && (
          <DrawerSection title="Promote with template">
            <Group gap={8} wrap="nowrap" align="flex-end">
              <Select
                className={styles.templateSelect}
                data={caseTemplates.map((template) => ({
                  value: template.id,
                  label: template.name,
                }))}
                value={templateId || null}
                onChange={(value) => setTemplateId(value ?? '')}
                disabled={caseTemplates.length === 0}
                placeholder="No templates found"
                allowDeselect={false}
                style={{ flex: 1 }}
              />
              <Button
                className={styles.templateLink}
                component="a"
                href={
                  selectedTemplate
                    ? `/case-templates/${selectedTemplate.id}`
                    : undefined
                }
                target="_blank"
                rel="noreferrer"
                variant="default"
                leftSection={<ExternalLink size={12} />}
                disabled={!selectedTemplate}
              >
                View case template
              </Button>
            </Group>
            <Text mt={6} ff="monospace" fz={10} c="dimmed">
              pre-loads tasks, custom fields, TLP/PAP & tags
            </Text>
            {selectedTemplate && (
              <Group gap={6} mt={8} wrap="wrap">
                <Tag label={`SEV ${SEV[selectedTemplate.sev].toUpperCase()}`} />
                <Tag label={`TLP ${TLP[selectedTemplate.tlp].toUpperCase()}`} />
                <Tag label={`${selectedTemplate.tasks.length} tasks`} />
                <Tag
                  label={`${selectedTemplate.customFields.length} custom fields`}
                />
              </Group>
            )}
            <Button
              fullWidth
              mt="md"
              color="orange"
              loading={promotionPending}
              disabled={!selectedTemplate}
              onClick={createCaseWithTemplate}
            >
              Create case with template
            </Button>
          </DrawerSection>
        )}
      </Box>
    </Drawer>
  )
}

function SimilarCaseTable({
  rows,
  onOpen,
}: {
  rows: AlertSimilarCase[]
  onOpen: (id: string) => void
}) {
  if (rows.length === 0) {
    return (
      <Text fz={13} c="dimmed">
        No similar cases found.
      </Text>
    )
  }
  return (
    <Table.ScrollContainer minWidth={0}>
      <Table verticalSpacing={7} fz={13} highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Case</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((similar) => (
            <Table.Tr
              key={similar.id}
              onClick={() => onOpen(similar.id)}
              style={{ cursor: 'pointer' }}
            >
              <Table.Td>
                <Severity id={similar.id} sev={similar.sev} />
              </Table.Td>
              <Table.Td>
                <Text fz={13} fw={500} truncate maw={200}>
                  {similar.title}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge size="xs" variant="light" color="blue">
                  {similar.status}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function ObservableTable({ rows }: { rows: AlertObservableRow[] }) {
  if (rows.length === 0) {
    return (
      <Text fz={13} c="dimmed">
        No observables on this alert.
      </Text>
    )
  }
  return (
    <Table.ScrollContainer minWidth={0}>
      <Table verticalSpacing={7} fz={13}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Type</Table.Th>
            <Table.Th>Value</Table.Th>
            <Table.Th>TLP</Table.Th>
            <Table.Th>IOC</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((observable) => (
            <Table.Tr key={observable.id}>
              <Table.Td>
                <Badge
                  variant="outline"
                  color="gray"
                  radius="sm"
                  ff="monospace"
                >
                  {observable.type}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text fz={13} ff="monospace" truncate maw={220}>
                  {observable.value}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text ff="monospace" fz={12} c="dimmed">
                  {TLP[observable.tlp].toUpperCase()}
                </Text>
              </Table.Td>
              <Table.Td>
                {observable.ioc ? (
                  <Badge color="red" variant="light" radius="sm" size="sm">
                    IOC
                  </Badge>
                ) : (
                  <Text c="dimmed">—</Text>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}

function DrawerSection({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box px={22} py={16} style={{ borderTop: '1px solid var(--line-soft)' }}>
      <Group mb={10} gap="xs" wrap="nowrap">
        <Text component="h3" className={styles.columnHeader} m={0}>
          {title}
        </Text>
        {count != null ? (
          <Badge
            size="xs"
            variant="light"
            color="gray"
            radius="xl"
            data-testid={`drawer-section-${title.toLowerCase().replace(/\s+/g, '-')}-count`}
          >
            {count}
          </Badge>
        ) : null}
        {action && (
          <Group ml="auto" gap={6}>
            {action}
          </Group>
        )}
      </Group>
      {children}
    </Box>
  )
}

function KeyValue({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Group gap={12} mb={6} wrap="nowrap" align="flex-start">
      <Text ff="monospace" fz={12} c="dimmed" w={110}>
        {label}
      </Text>
      <Box fz={13} style={{ flex: 1 }}>
        {children}
      </Box>
    </Group>
  )
}
