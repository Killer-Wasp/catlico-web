import type {
  CaseDetail,
  CaseDetailTask,
  CaseDetailTaskLog,
} from '#/components/Cases/caseDetails.types'
import {
  caseTaskLogsQueryOptions,
  createTaskWorkLog,
  invalidateTaskQueries,
  invalidateWorkLogQueries,
  updateTaskDetailFields,
  updateTaskWorkLog,
} from '#/components/Cases/casesQueries'
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAssigneeStringOptions } from '#/components/Assign/assigneeOptions'
import { ArrowLeft, Flag, Paperclip, Pencil } from 'lucide-react'
import { useState } from 'react'
import { CaseDrawerSection } from './CaseDrawerSection'
import { actionNotice } from './constants'
import styles from './styles.module.css'
import { TaskMarkdownEditor } from './TaskMarkdownEditor'
import {
  formatDueInput,
  formatTaskDateTime,
  isTaskOverdue,
  TASK_EDGE_COLOR,
  TASK_STATUS,
  TASK_STATUS_OPTIONS,
} from './taskHelpers'

export function TaskDetailPanel({
  task,
  caseDetail,
  caseId,
  onTaskChange,
  onBack,
}: {
  task: CaseDetailTask
  caseDetail: CaseDetail
  caseId: string
  onTaskChange: (patch: Partial<CaseDetailTask>) => void
  onBack: () => void
}) {
  const queryClient = useQueryClient()
  const assigneeOptions = useAssigneeStringOptions(task.assignee)
  const [editingDescription, setEditingDescription] = useState(false)
  const [savingDescription, setSavingDescription] = useState(false)

  // Work-logs are fetched here — this panel only mounts once a task is opened,
  // so the logs request fires exactly when the analyst opens the task details.
  const { data: workLogs = [] } = useQuery(
    caseTaskLogsQueryOptions(caseId, task.apiId),
  )

  async function saveDescription(markdown: string) {
    setSavingDescription(true)
    try {
      await updateTaskDetailFields({
        caseId: task.caseId,
        taskId: task.apiId,
        description: markdown,
      })
      onTaskChange({ description: markdown })
      invalidateTaskQueries(queryClient, caseId)
      setEditingDescription(false)
      actionNotice('Task description saved')
    } finally {
      setSavingDescription(false)
    }
  }

  async function updateStatus(status: CaseDetailTask['status'] | null) {
    if (!status || status === task.status) return
    onTaskChange({ status })
    await updateTaskDetailFields({
      caseId: task.caseId,
      taskId: task.apiId,
      status,
    })
    invalidateTaskQueries(queryClient, caseId)
    actionNotice(`Task status set to ${TASK_STATUS[status].label}`)
  }

  return (
    <Box
      style={{
        borderLeft: `4px solid ${TASK_EDGE_COLOR[task.status]}`,
      }}
    >
      <Group px={22} pb={12}>
        <Button
          variant="subtle"
          color="gray"
          size="xs"
          leftSection={<ArrowLeft size={14} />}
          onClick={onBack}
        >
          Back to tasks
        </Button>
      </Group>

      <Box px={22} pb={16}>
        <Text ff="monospace" fz={12} c="dimmed" mb={8}>
          {caseDetail.id} · task {task.id}
        </Text>
        <TextInput
          value={task.title}
          readOnly
          rightSection={
            task.flagged ? (
              <Flag size={16} color="var(--sev-high)" fill="var(--sev-high)" />
            ) : null
          }
          styles={{ input: { fontWeight: 700, fontSize: 18 } }}
        />
      </Box>

      <CaseDrawerSection title="Status">
        <Select
          label="Status"
          data={TASK_STATUS_OPTIONS}
          value={task.status}
          onChange={(value) => updateStatus(value)}
          allowDeselect={false}
          w={{ base: '100%', sm: 240 }}
        />
        <Group gap={8} mt={12} wrap="wrap">
          <Text ff="monospace" fz={12} c="dimmed">
            start {task.start ? formatTaskDateTime(task.start) : '—'}
          </Text>
          <Text ff="monospace" fz={12} c="dimmed">
            end {task.end ? formatTaskDateTime(task.end) : '—'}
          </Text>
          <Text ff="monospace" fz={12} c="red">
            {task.due && task.status !== 'completed'
              ? isTaskOverdue(task)
                ? 'overdue'
                : ''
              : ''}
          </Text>
        </Group>
      </CaseDrawerSection>

      <CaseDrawerSection title="Details">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Box>
            <Text className={styles.fieldLabel} mb={6}>
              Group
            </Text>
            <TextInput value={task.group} readOnly />
          </Box>
          <Box>
            <Text className={styles.fieldLabel} mb={6}>
              Assignee
            </Text>
            <Select
              data={assigneeOptions}
              value={task.assignee}
              onChange={() => actionNotice('Assignee changed')}
              allowDeselect={false}
            />
          </Box>
          <Box style={{ gridColumn: '1 / -1' }}>
            <Text className={styles.fieldLabel} mb={6}>
              Due date
            </Text>
            <TextInput
              value={task.due ? formatDueInput(task.due) : ''}
              readOnly
            />
          </Box>
        </SimpleGrid>
      </CaseDrawerSection>

      <CaseDrawerSection
        title="Description"
        action={
          !editingDescription ? (
            <Button
              size="xs"
              variant="default"
              leftSection={<Pencil size={13} />}
              onClick={() => setEditingDescription(true)}
            >
              Edit description
            </Button>
          ) : null
        }
      >
        {editingDescription ? (
          <TaskMarkdownEditor
            ariaLabel="Task description"
            initialMarkdown={task.description}
            saveLabel="Save description"
            saving={savingDescription}
            onSave={saveDescription}
          />
        ) : (
          <Paper withBorder radius="sm" p="sm" bg="gray.0">
            <Text fz={14} lh={1.45}>
              {task.description || 'No description yet.'}
            </Text>
          </Paper>
        )}
      </CaseDrawerSection>

      <TaskWorkLogsSection task={task} caseId={caseId} workLogs={workLogs} />
    </Box>
  )
}

function TaskWorkLogsSection({
  task,
  caseId,
  workLogs,
}: {
  task: CaseDetailTask
  caseId: string
  workLogs: CaseDetailTaskLog[]
}) {
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const [savingNew, setSavingNew] = useState(false)

  async function saveNewLog(markdown: string) {
    setSavingNew(true)
    try {
      await createTaskWorkLog({
        caseId: task.caseId,
        taskId: task.apiId,
        bodyMarkdown: markdown,
        files,
      })
      setFiles([])
      invalidateWorkLogQueries(queryClient, caseId)
      actionNotice('Work log saved')
    } finally {
      setSavingNew(false)
    }
  }

  return (
    <CaseDrawerSection title={`Work logs ${workLogs.length}`}>
      <Stack gap="sm">
        {workLogs.length ? (
          workLogs.map((log) => (
            <TaskWorkLogCard
              key={log.id}
              task={task}
              log={log}
              caseId={caseId}
            />
          ))
        ) : (
          <Text fz={13} c="dimmed">
            No work logs yet.
          </Text>
        )}

        <TaskMarkdownEditor
          ariaLabel="Add work log"
          initialMarkdown=""
          saveLabel="Save work log"
          saving={savingNew}
          files={files}
          onFilesChange={setFiles}
          onSave={saveNewLog}
        />
      </Stack>
    </CaseDrawerSection>
  )
}

function TaskWorkLogCard({
  task,
  log,
  caseId,
}: {
  task: CaseDetailTask
  log: CaseDetailTaskLog
  caseId: string
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  async function save(markdown: string) {
    setSaving(true)
    try {
      await updateTaskWorkLog({
        caseId: task.caseId,
        taskId: task.apiId,
        logId: log.apiId,
        bodyMarkdown: markdown,
      })
      invalidateWorkLogQueries(queryClient, caseId)
      setEditing(false)
      actionNotice('Work log updated')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Paper radius="sm" p="sm" bg="gray.0" withBorder>
      <Group justify="space-between" align="flex-start" gap="sm" mb={6}>
        <Text ff="monospace" fz={12} c="dimmed">
          {log.author} · {log.time}
        </Text>
        {!editing ? (
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<Pencil size={13} />}
            onClick={() => setEditing(true)}
          >
            Edit work log from {log.author} at {log.time}
          </Button>
        ) : null}
      </Group>

      {editing ? (
        <TaskMarkdownEditor
          ariaLabel={`Edit work log ${log.id}`}
          initialMarkdown={log.body}
          saveLabel="Save work log"
          saving={saving}
          onSave={save}
        />
      ) : (
        <Text fz={13} lh={1.45}>
          {log.body}
        </Text>
      )}

      {log.attachments.length ? (
        <Group gap={6} mt="sm" wrap="wrap">
          {log.attachments.map((attachment) => (
            <Badge
              key={attachment.id}
              variant="outline"
              radius="sm"
              leftSection={<Paperclip size={12} />}
            >
              {attachment.name}
              {attachment.size ? ` · ${attachment.size}` : ''}
            </Badge>
          ))}
        </Group>
      ) : null}
    </Paper>
  )
}
