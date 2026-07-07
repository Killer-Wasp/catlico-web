import type {
  CaseDetail,
  CaseDetailTask,
} from '#/components/Cases/caseDetails.types'
import { caseKeys, createCaseTask } from '#/components/Cases/casesQueries'
import {
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, Hourglass, Plus } from 'lucide-react'
import { useState } from 'react'
import { CasePanelHeader } from './CasePanelHeader'
import { actionNotice } from './constants'
import styles from './styles.module.css'
import { TaskDetailPanel } from './TaskDetailPanel'
import { formatDue, TASK_STATUS, taskMeta } from './taskHelpers'

export function TasksPanel({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  const [activeTask, setActiveTask] = useState<CaseDetailTask | null>(null)
  const [addingTask, setAddingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const tasks = caseDetail.tasks
  const queryClient = useQueryClient()

  const addTask = useMutation({
    mutationFn: (title: string) => createCaseTask(caseId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setNewTaskTitle('')
      setAddingTask(false)
      actionNotice('Task added')
    },
    onError: () => actionNotice('Failed to add task'),
  })

  function submitNewTask() {
    const title = newTaskTitle.trim()
    if (!title || addTask.isPending) return
    addTask.mutate(title)
  }

  if (activeTask) {
    return (
      <Stack gap="md" p="lg">
        <CasePanelHeader label="Tasks" />
        <TaskDetailPanel
          task={activeTask}
          caseDetail={caseDetail}
          caseId={caseId}
          onTaskChange={(patch) =>
            setActiveTask((task) => (task ? { ...task, ...patch } : task))
          }
          onBack={() => setActiveTask(null)}
        />
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Modal
        opened={addingTask}
        onClose={() => setAddingTask(false)}
        title="Add task"
      >
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="Revoke refresh tokens for affected users"
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitNewTask()
            }}
            disabled={addTask.isPending}
            required
          />
          <Button
            fullWidth
            onClick={submitNewTask}
            loading={addTask.isPending}
            disabled={!newTaskTitle.trim()}
          >
            Add task
          </Button>
        </Stack>
      </Modal>

      <CasePanelHeader
        label="Tasks"
        action={
          <Button
            variant="default"
            leftSection={<Plus size={16} />}
            onClick={() => setAddingTask(true)}
          >
            Add Task
          </Button>
        }
      />

      <Table
        aria-label="Case tasks"
        verticalSpacing="sm"
        horizontalSpacing={0}
        highlightOnHover
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th className={styles.fieldLabel} fw={500}>
              Task
            </Table.Th>
            <Table.Th className={styles.fieldLabel} fw={500}>
              Status
            </Table.Th>
            <Table.Th className={styles.fieldLabel} fw={500} ta="right">
              Due
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tasks.map((task) => {
            const done = task.status === 'completed'
            return (
              <Table.Tr
                key={task.id}
                tabIndex={0}
                onClick={() => setActiveTask(task)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') setActiveTask(task)
                }}
                style={{ cursor: 'pointer' }}
              >
                <Table.Td>
                  <Box miw={0}>
                    <Group gap={6} wrap="nowrap" miw={0}>
                      <Text fw={650} truncate>
                        {task.title}
                      </Text>
                      {task.flagged ? (
                        <Flag
                          size={13}
                          color="var(--sev-high)"
                          fill="var(--sev-high)"
                          style={{ flexShrink: 0 }}
                        />
                      ) : null}
                      <Text
                        ff="monospace"
                        fz={11}
                        c="dimmed"
                        style={{ flexShrink: 0 }}
                      >
                        {taskMeta(task)}
                      </Text>
                    </Group>
                  </Box>
                </Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    radius="sm"
                    size="sm"
                    tt="uppercase"
                    fw={700}
                    color={TASK_STATUS[task.status].color}
                  >
                    {TASK_STATUS[task.status].label}
                  </Badge>
                </Table.Td>
                <Table.Td ta="right">
                  {task.due ? <DueBadge due={task.due} done={done} /> : null}
                </Table.Td>
              </Table.Tr>
            )
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

function DueBadge({ due, done }: { due: string; done: boolean }) {
  return (
    <Badge
      variant={done ? 'light' : 'outline'}
      radius="sm"
      size="sm"
      ff="monospace"
      color={done ? 'gray' : 'red'}
      c={done ? 'dimmed' : 'red'}
      leftSection={<Hourglass size={11} />}
      style={{ flexShrink: 0 }}
    >
      {formatDue(due)}
    </Badge>
  )
}
