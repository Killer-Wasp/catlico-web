import type {
  CaseDetail,
  CaseDetailTask,
} from '#/components/Cases/caseDetails.types'
import { caseKeys, createCaseTask } from '#/components/Cases/casesQueries'
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, Hourglass } from 'lucide-react'
import { useState } from 'react'
import { actionNotice } from './constants'
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
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const tasks = caseDetail.tasks
  const queryClient = useQueryClient()

  const addTask = useMutation({
    mutationFn: (title: string) => createCaseTask(caseId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setNewTaskTitle('')
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
      <Stack gap={0} p="lg">
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
    <Stack gap={0} p="lg">
      {tasks.map((task) => {
        const done = task.status === 'completed'
        return (
          <Group
            key={task.id}
            gap="sm"
            wrap="nowrap"
            py={10}
            tabIndex={0}
            onClick={() => setActiveTask(task)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setActiveTask(task)
            }}
            style={{ borderBottom: '1px solid var(--line-soft)' }}
          >
            <Checkbox
              radius="sm"
              size="sm"
              color="green"
              defaultChecked={done}
              aria-label={`Mark ${task.title} complete`}
              onClick={(event) => event.stopPropagation()}
            />
            <Box miw={0} flex={1}>
              <Group gap={6} wrap="nowrap" miw={0}>
                <Text
                  fw={650}
                  truncate
                  td={done ? 'line-through' : undefined}
                  c={done ? 'dimmed' : undefined}
                >
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
            {task.due ? <DueBadge due={task.due} done={done} /> : null}
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
          </Group>
        )
      })}

      <Group gap="sm" wrap="nowrap" pt="md">
        <TextInput
          flex={1}
          placeholder="Add a task… e.g. Revoke refresh tokens for affected users"
          value={newTaskTitle}
          onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitNewTask()
          }}
          disabled={addTask.isPending}
        />
        <Button
          variant="default"
          onClick={submitNewTask}
          loading={addTask.isPending}
          disabled={!newTaskTitle.trim()}
        >
          Add
        </Button>
      </Group>
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
