import type { Task, TaskStatus, TaskStatusFilter } from './tasks.types'

export const TASK_STATUS_TABS: { value: TaskStatusFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'inprogress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
]

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  waiting: 'WAITING',
  inprogress: 'IN PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
}

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  waiting: 'gray',
  inprogress: 'yellow',
  completed: 'green',
  cancelled: 'red',
}

export const initialTasks: Task[] = [
  {
    id: 'T-1842-1',
    title: 'Disable malicious app registration tenant-wide',
    description: 'OAuth consent grant - privileged account compromise',
    kind: 'Contain',
    flagged: true,
    caseId: '#1842',
    caseSeverity: 'high',
    assignee: 'J. Tanaka',
    due: 'Fri 01:00 pm',
    urgent: true,
    status: 'inprogress',
  },
  {
    id: 'T-1842-2',
    title: 'Remove mailbox rules and check forwarding',
    description: 'OAuth consent grant - privileged account compromise',
    kind: 'Eradicate',
    caseId: '#1842',
    caseSeverity: 'high',
    assignee: 'A. Whitford',
    due: 'Fri 02:00 pm',
    urgent: true,
    status: 'inprogress',
  },
  {
    id: 'T-1842-3',
    title: 'Hunt for same app id across all tenants',
    description: 'OAuth consent grant - privileged account compromise',
    kind: 'Hunt',
    caseId: '#1842',
    caseSeverity: 'high',
    due: 'Sat 12:00 pm',
    urgent: true,
    status: 'waiting',
  },
  {
    id: 'T-1842-4',
    title: 'User comms + phishing-resistant MFA enrolment',
    description: 'OAuth consent grant - privileged account compromise',
    kind: 'Recover',
    caseId: '#1842',
    caseSeverity: 'high',
    due: 'Sun 05:00 pm',
    urgent: true,
    status: 'waiting',
  },
  {
    id: 'T-1841-1',
    title: 'Identify ransomware family and variant',
    description: 'Ransomware staging on FILESRV-AU02',
    kind: 'Identify',
    caseId: '#1841',
    caseSeverity: 'critical',
    assignee: 'P. Nguyen',
    due: '06:00 pm (overdue)',
    overdue: true,
    status: 'inprogress',
  },
  {
    id: 'T-1839-1',
    title: 'Engage OT/ICS team before any blocking',
    description: 'Beaconing from OT jump host - rare destination',
    kind: 'Scoping',
    flagged: true,
    caseId: '#1839',
    caseSeverity: 'high',
    assignee: 'A. Whitford',
    due: '12:00 pm today',
    status: 'inprogress',
  },
  {
    id: 'T-1841-2',
    title: 'Snapshot affected hypervisor cluster',
    description: 'Ransomware staging on FILESRV-AU02',
    kind: 'Contain',
    caseId: '#1841',
    caseSeverity: 'critical',
    assignee: 'J. Tanaka',
    due: 'today 03:30 pm',
    status: 'waiting',
  },
  {
    id: 'T-1842-5',
    title: 'Publish executive situation summary',
    description: 'OAuth consent grant - privileged account compromise',
    kind: 'Comms',
    caseId: '#1842',
    caseSeverity: 'high',
    assignee: 'M. Clarke',
    due: 'today 04:00 pm',
    status: 'waiting',
  },
  {
    id: 'T-1841-3',
    title: 'Pull EDR timeline for initial access',
    description: 'Ransomware staging on FILESRV-AU02',
    kind: 'Forensics',
    caseId: '#1841',
    caseSeverity: 'critical',
    assignee: 'P. Nguyen',
    due: 'tomorrow 09:00 am',
    status: 'inprogress',
  },
  {
    id: 'T-1838-1',
    title: 'Review service account conditional access',
    description: 'Suspicious service principal sign-in burst',
    kind: 'Review',
    caseId: '#1838',
    caseSeverity: 'high',
    due: 'tomorrow 10:00 am',
    status: 'waiting',
  },
  {
    id: 'T-1841-4',
    title: 'Confirm backups are clean and restorable',
    description: 'Ransomware staging on FILESRV-AU02',
    kind: 'Recover',
    caseId: '#1841',
    caseSeverity: 'critical',
    assignee: 'A. Whitford',
    due: 'tomorrow 02:00 pm',
    status: 'waiting',
  },
  {
    id: 'T-1842-6',
    title: 'Collect SaaS audit logs for legal hold',
    description: 'OAuth consent grant - privileged account compromise',
    kind: 'Evidence',
    caseId: '#1842',
    caseSeverity: 'high',
    assignee: 'M. Clarke',
    due: 'Mon 09:00 am',
    status: 'waiting',
  },
  {
    id: 'T-1839-2',
    title: 'Validate containment on edge firewall',
    description: 'Beaconing from OT jump host - rare destination',
    kind: 'Contain',
    caseId: '#1839',
    caseSeverity: 'high',
    due: 'Mon 11:30 am',
    status: 'waiting',
  },
  {
    id: 'T-1838-2',
    title: 'Prepare customer impact statement',
    description: 'Suspicious service principal sign-in burst',
    kind: 'Comms',
    caseId: '#1838',
    caseSeverity: 'high',
    assignee: 'M. Clarke',
    due: 'Mon 03:00 pm',
    status: 'waiting',
  },
  {
    id: 'T-1842-7',
    title: 'Archive mailbox investigation artefacts',
    description: 'OAuth consent grant - privileged account compromise',
    kind: 'Closeout',
    caseId: '#1842',
    caseSeverity: 'high',
    assignee: 'J. Tanaka',
    due: 'Tue 02:00 pm',
    status: 'waiting',
  },
  {
    id: 'T-1837-1',
    title: 'Draft unused endpoint quarantine plan',
    description: 'Duplicate endpoint telemetry review',
    kind: 'Planning',
    caseId: '#1837',
    caseSeverity: 'high',
    due: 'Wed 09:00 am',
    status: 'waiting',
  },
  {
    id: 'T-1842-8',
    title: 'Check privileged inbox delegates',
    description: 'OAuth consent grant - privileged account compromise',
    kind: 'Review',
    caseId: '#1842',
    caseSeverity: 'high',
    assignee: 'A. Whitford',
    due: 'Tue 10:00 am',
    status: 'waiting',
  },
]

export function filterTasksByStatus(tasks: Task[], filter: TaskStatusFilter) {
  if (filter === 'all') return tasks
  if (filter === 'open') {
    return tasks.filter(
      (task) => task.status !== 'completed' && task.status !== 'cancelled',
    )
  }
  return tasks.filter((task) => task.status === filter)
}

export function advanceTaskStatus(status: TaskStatus): TaskStatus {
  if (status === 'waiting') return 'inprogress'
  if (status === 'inprogress') return 'completed'
  return status
}

export function allocateNextTaskId(
  tasks: Array<Pick<Task, 'id' | 'caseId'>>,
  caseId: string,
) {
  const caseNumber = caseId.replace('#', '')
  const prefix = `T-${caseNumber}-`
  const maxSequence = tasks
    .filter((task) => task.caseId.replace('#', '') === caseNumber)
    .reduce((max, task) => {
      if (!task.id.startsWith(prefix)) return max
      const sequence = Number(task.id.slice(prefix.length))
      return Number.isInteger(sequence) ? Math.max(max, sequence) : max
    }, 0)

  return `${prefix}${maxSequence + 1}`
}

export function avatarFor(name: string): [string, string] {
  const initials = name
    .split(/\s+/)
    .map((part) => part.replace('.', '').at(0))
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const colors = ['orange', 'teal', 'brown', 'indigo', 'grape']
  const index = Array.from(name).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  )

  return [initials || '?', colors[index % colors.length]]
}
