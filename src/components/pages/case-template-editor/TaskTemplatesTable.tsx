import { useAssigneeSelectOptions } from '#/components/Assign/assigneeOptions'
import { AppDrawer } from '#/components/ui/AppDrawer'
import { RichTextField } from './RichTextField'
import type { DraftTask } from './draft'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import {
  ArrowDown,
  ArrowUp,
  Flag,
  GripVertical,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

function TaskRow({
  task,
  index,
  onEdit,
  onRemove,
}: {
  task: DraftTask
  index: number
  onEdit: () => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.draftId })

  return (
    <Table.Tr
      ref={setNodeRef}
      style={{
        cursor: 'pointer',
        opacity: isDragging ? 0.65 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onClick={onEdit}
    >
      <Table.Td w={96}>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Drag task ${index + 1}`}
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <GripVertical size={15} />
          </ActionIcon>
          <Text ff="monospace" c="dimmed" w={24} ta="right">
            {index + 1}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          {task.flagged ? (
            <Flag size={14} color="var(--mantine-color-orange-6)" />
          ) : null}
          <Text fw={500} truncate>
            {task.title.trim() || 'Untitled task'}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Badge variant="light" color="gray">
          {task.group.trim() || 'default'}
        </Badge>
      </Table.Td>
      <Table.Td>
        <Badge variant="light" ff="monospace">
          {task.dueAmount || '0'} {task.dueUnit}
        </Badge>
      </Table.Td>
      <Table.Td>{task.assignee || '-'}</Table.Td>
      <Table.Td ta="right">
        <Menu withinPortal position="bottom-end">
          <Menu.Target>
            <ActionIcon
              variant="default"
              aria-label={`Actions for task ${index + 1}`}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreVertical size={15} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Pencil size={14} />} onClick={onEdit}>
              Edit
            </Menu.Item>
            <Menu.Item
              leftSection={<Trash2 size={14} />}
              color="red"
              onClick={onRemove}
            >
              Remove
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  )
}

export function TaskFormModal({
  mode,
  initialTask,
  canMoveUp,
  canMoveDown,
  onClose,
  onSave,
  onMove,
}: {
  mode: 'create' | 'edit'
  initialTask: DraftTask
  canMoveUp: boolean
  canMoveDown: boolean
  onClose: () => void
  onSave: (task: DraftTask) => void
  onMove: (direction: -1 | 1) => void
}) {
  const [task, setTask] = useState<DraftTask>(initialTask)
  const assigneeOptions = useAssigneeSelectOptions(task.assignee)
  const update = (patch: Partial<DraftTask>) =>
    setTask((current) => ({ ...current, ...patch }))

  return (
    <AppDrawer
      opened
      onClose={onClose}
      title={mode === 'create' ? 'New task' : 'Edit task'}
      footer={
        <Group justify="space-between" mt="sm">
          <Group gap="xs">
            {mode === 'edit' ? (
              <>
                <ActionIcon
                  variant="default"
                  aria-label="Move task up"
                  disabled={!canMoveUp}
                  onClick={() => onMove(-1)}
                >
                  <ArrowUp size={15} />
                </ActionIcon>
                <ActionIcon
                  variant="default"
                  aria-label="Move task down"
                  disabled={!canMoveDown}
                  onClick={() => onMove(1)}
                >
                  <ArrowDown size={15} />
                </ActionIcon>
              </>
            ) : null}
          </Group>
          <Group gap="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="orange"
              disabled={!task.title.trim()}
              onClick={() => onSave(task)}
            >
              Save
            </Button>
          </Group>
        </Group>
      }
    >
      <Stack gap="sm">
        <TextInput
          label="Task title"
          required
          autoFocus
          value={task.title}
          onChange={(event) => update({ title: event.currentTarget.value })}
        />
        <TextInput
          label="Group"
          value={task.group}
          onChange={(event) => update({ group: event.currentTarget.value })}
        />
        <RichTextField
          label="Description"
          value={task.description}
          onChange={(description) => update({ description })}
        />
        <SimpleGrid cols={2}>
          <Box>
            <Text ff="monospace" fz={10} c="dimmed" tt="uppercase" mb={4}>
              Due in
            </Text>
            <Group gap={6} wrap="nowrap">
              <TextInput
                type="number"
                min={0}
                value={task.dueAmount}
                onChange={(event) =>
                  update({ dueAmount: event.currentTarget.value })
                }
                aria-label="Due amount"
              />
              <Select
                data={['hours', 'days']}
                value={task.dueUnit}
                onChange={(value) => update({ dueUnit: value ?? 'hours' })}
                aria-label="Due unit"
                w={96}
              />
            </Group>
          </Box>
          <Select
            label="Assignee"
            data={assigneeOptions}
            value={task.assignee}
            onChange={(value) => update({ assignee: value ?? '' })}
          />
        </SimpleGrid>
        <Switch
          label="Flagged"
          checked={task.flagged}
          onChange={(event) => update({ flagged: event.currentTarget.checked })}
        />
      </Stack>
    </AppDrawer>
  )
}

export function TaskTemplatesTable({
  tasks,
  onEdit,
  onRemove,
  onReorder,
}: {
  tasks: DraftTask[]
  onEdit: (index: number) => void
  onRemove: (index: number) => void
  onReorder: (oldIndex: number, newIndex: number) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleTaskDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex((task) => task.draftId === active.id)
    const newIndex = tasks.findIndex((task) => task.draftId === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    onReorder(oldIndex, newIndex)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleTaskDragEnd}
    >
      <SortableContext
        items={tasks.map((task) => task.draftId)}
        strategy={verticalListSortingStrategy}
      >
        <Table.ScrollContainer minWidth={760}>
          <Table
            aria-label="Template tasks"
            highlightOnHover
            horizontalSpacing="md"
            verticalSpacing="sm"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order</Table.Th>
                <Table.Th>Task</Table.Th>
                <Table.Th>Group</Table.Th>
                <Table.Th>Due</Table.Th>
                <Table.Th>Assignee</Table.Th>
                <Table.Th aria-label="Task actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tasks.map((task, index) => (
                <TaskRow
                  key={task.draftId}
                  task={task}
                  index={index}
                  onEdit={() => onEdit(index)}
                  onRemove={() => onRemove(index)}
                />
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </SortableContext>
    </DndContext>
  )
}
