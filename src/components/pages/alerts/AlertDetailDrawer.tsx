import type { Alert } from '#/components/Alerts/alerts.types'
import type { CaseTemplate } from '#/components/Cases/caseTemplates.types'
import { fmtAge } from '#/components/Alerts/alerts'
import { SEV, TLP, TLP_COLOR } from '#/lib/domain'
import { Tag } from '#/components/Tag/Tag'
import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  VisuallyHidden,
} from '@mantine/core'
import { Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import styles from './styles.module.css'

export function AlertDetailDrawer({
  alert,
  caseTemplates,
  comments,
  onClose,
  onAddComment,
  onDismiss,
  onMergeIntoCase,
  onRunAnalysis,
  onPromote,
  promotionPending,
}: {
  alert: Alert | null
  caseTemplates: CaseTemplate[]
  comments: string[]
  onClose: () => void
  onAddComment: (id: string, note: string) => void
  onDismiss: (id: string) => void
  onMergeIntoCase: (id: string) => void
  onRunAnalysis: (id: string) => void
  onPromote: (id: string, templateId: string) => void
  promotionPending: boolean
}) {
  const [note, setNote] = useState('')
  const [templateId, setTemplateId] = useState('')

  useEffect(() => {
    if (!templateId && caseTemplates.length > 0) {
      setTemplateId(caseTemplates[0].id)
    }
  }, [caseTemplates, templateId])

  const selectedTemplate =
    caseTemplates.find((template) => template.id === templateId) ??
    (caseTemplates.length > 0 ? caseTemplates[0] : undefined)

  const close = () => {
    setNote('')
    onClose()
  }

  if (!alert) return null

  const tlpName = TLP[alert.tlp]
  const reference = `${alert.src.toLowerCase().replace(/\s+/g, '-')}:${alert.id.toLowerCase()}`

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
          <Text fw={700} fz={18} lh={1.25} pr={36}>
            {alert.title}
          </Text>
          <Group gap={7} mt={12} wrap="wrap">
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
            {alert.tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </Group>
        </Box>

        <DrawerSection title="Details">
          <KeyValue label="Source">{alert.src}</KeyValue>
          <KeyValue label="First seen">{fmtAge(alert.ageMin)} ago</KeyValue>
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
        </DrawerSection>

        <DrawerSection title="Similar cases">
          {alert.similarCases.length ? (
            <Stack gap={0}>
              {alert.similarCases.map((similar) => (
                <Group
                  key={similar.id}
                  py={8}
                  gap={10}
                  wrap="nowrap"
                  style={{ borderBottom: '1px solid var(--line-soft)' }}
                >
                  <Text ff="monospace" fz={12} c="dimmed">
                    {similar.id}
                  </Text>
                  <Text fz={13} fw={500} truncate style={{ flex: 1 }}>
                    {similar.title}
                  </Text>
                  <Badge size="xs" variant="light" color="blue">
                    {similar.status}
                  </Badge>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text fz={13} c="dimmed">
              No similar cases found.
            </Text>
          )}
        </DrawerSection>

        <DrawerSection title={`Comments ${comments.length}`}>
          <Stack gap={8}>
            {comments.length ? (
              comments.map((comment, index) => (
                <Text key={`${alert.id}-comment-${index}`} fz={13} c="dimmed">
                  {comment}
                </Text>
              ))
            ) : (
              <Text fz={13} c="dimmed">
                No triage notes yet — they transfer to the case on promotion.
              </Text>
            )}
            <Textarea
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

        <DrawerSection title="Promote with template">
          <Select
            data={caseTemplates.map((template) => ({
              value: template.id,
              label: template.name,
            }))}
            value={templateId || null}
            onChange={(value) => setTemplateId(value ?? '')}
            disabled={caseTemplates.length === 0}
            placeholder="No templates found"
            allowDeselect={false}
          />
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
        </DrawerSection>

        <Group
          p={16}
          gap={10}
          wrap="nowrap"
          style={{
            position: 'sticky',
            bottom: 0,
            background: 'var(--mantine-color-body)',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <Button
            fullWidth
            variant="default"
            onClick={() => {
              onDismiss(alert.id)
              close()
            }}
          >
            Dismiss
          </Button>
          <Button
            fullWidth
            variant="default"
            onClick={() => onMergeIntoCase(alert.id)}
          >
            Merge into case...
          </Button>
          <Button
            fullWidth
            color="orange"
            loading={promotionPending}
            onClick={() => onPromote(alert.id, templateId)}
          >
            Promote to case
          </Button>
        </Group>
      </Box>
    </Drawer>
  )
}

function DrawerSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Box px={22} py={16} style={{ borderTop: '1px solid var(--line-soft)' }}>
      <Group mb={10} gap="xs" wrap="nowrap">
        <Text component="h3" className={styles.columnHeader} m={0}>
          {title}
        </Text>
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
