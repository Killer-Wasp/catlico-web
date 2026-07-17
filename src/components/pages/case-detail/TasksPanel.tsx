import type {
  CaseDetail,
  CaseDetailTask,
} from '#/components/Cases/caseDetails.types'
import {
  caseTasksQueryOptions,
  createCaseTask,
  invalidateTaskQueries,
} from '#/components/Cases/casesQueries'
import { AssigneeStack } from '#/components/Assign/AssigneeStack'
import { DataTable } from '#/components/Table/DataTable'
import { TablePanel } from '#/components/Table/TablePanel'
import type { TableColumnMeta } from '#/components/Table/columnMeta'
import { FormDrawer } from '#/components/ui/FormDrawer'
import {
  Badge,
  Box,
  Button,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Flag, Hourglass, Plus } from 'lucide-react'
import { useState } from 'react'
import { CasePanelHeader } from './CasePanelHeader'
import { actionNotice } from './constants'
import { TaskDetailPanel } from './TaskDetailPanel'
import { formatDue, TASK_STATUS, taskMeta } from './taskHelpers'

const COLUMNS: ColumnDef<CaseDetailTask>[] = [
  {
    id: 'task',
    header: 'Task name',
    meta: { grow: true } satisfies TableColumnMeta,
    cell: ({ row }) => {
      const task = row.original
      return (
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
            <Text ff="monospace" fz={11} c="dimmed" style={{ flexShrink: 0 }}>
              {taskMeta(task)}
            </Text>
          </Group>
        </Box>
      )
    },
  },
  {
    id: 'status',
    header: 'Status',
    meta: { nowrap: true } satisfies TableColumnMeta,
    cell: ({ row }) => (
      <Badge
        variant="light"
        radius="sm"
        size="sm"
        tt="uppercase"
        fw={700}
        color={TASK_STATUS[row.original.status].color}
      >
        {TASK_STATUS[row.original.status].label}
      </Badge>
    ),
  },
  {
    id: 'assignees',
    header: 'Assignees',
    meta: { ta: 'center', nowrap: true } satisfies TableColumnMeta,
    cell: ({ row }) => (
      <AssigneeStack assignees={row.original.assignees ?? []} />
    ),
  },
  {
    id: 'due',
    header: 'Due',
    meta: { ta: 'right', nowrap: true } satisfies TableColumnMeta,
    cell: ({ row }) =>
      row.original.due ? (
        <DueBadge
          due={row.original.due}
          done={row.original.status === 'completed'}
        />
      ) : null,
  },
]

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
  const { data: tasks = [] } = useQuery(caseTasksQueryOptions(caseId))
  const queryClient = useQueryClient()

  const addTask = useMutation({
    mutationFn: (title: string) => createCaseTask(caseId, title),
    onSuccess: () => {
      invalidateTaskQueries(queryClient, caseId)
      setNewTaskTitle('')
      setAddingTask(false)
      actionNotice('Task added')
    },
    onError: () => actionNotice('Failed to add task'),
  })

  const table = useReactTable({
    data: tasks,
    columns: COLUMNS,
    getRowId: (row) => row.id,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
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
      <FormDrawer
        opened={addingTask}
        onClose={() => setAddingTask(false)}
        title="Add task"
        submitLabel="Add task"
        loading={addTask.isPending}
        submitDisabled={!newTaskTitle.trim()}
        onSubmit={submitNewTask}
      >
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="Revoke refresh tokens for affected users"
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.currentTarget.value)}
            disabled={addTask.isPending}
            required
          />
        </Stack>
      </FormDrawer>

      <TablePanel
        title="Tasks"
        countNoun="tasks"
        table={table}
        withFilterBar={false}
        withPagination={false}
        actions={
          <Button
            variant="default"
            size="xs"
            leftSection={<Plus size={14} />}
            onClick={() => setAddingTask(true)}
          >
            Add Task
          </Button>
        }
      >
        <DataTable
          table={table}
          minWidth={520}
          ariaLabel="Case tasks"
          emptyMessage="No tasks for this case."
          onRowClick={(row) => setActiveTask(row.original)}
        />
      </TablePanel>
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
