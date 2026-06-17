// Mock case data + lookup tables for the Cases list.
// Ported from the design prototype (docs/webdesign.html). This is the
// same shape TheHive's `listCase` query returns, trimmed to what the
// list view needs.

// Severity type + name map live with the shared SeverityId component;
// re-exported here so existing case/alert imports keep resolving.
import { SEV } from '#/components/Severity/Severity'
import type { Severity } from '#/components/Severity/Severity'

export { SEV }
export type { Severity }

export type Tlp = 0 | 1 | 2 | 3
export type CaseStatus =
  | 'new'
  | 'open'
  | 'inprogress'
  | 'waiting'
  | 'resolved'
  | 'duplicated'

export type Case = {
  id: string
  sev: Severity
  tlp: Tlp
  status: CaseStatus
  statusName: string
  title: string
  assignee: string
  tags: string[]
  tasksDone: number
  tasksTotal: number
  updated: string
  duplicateOf?: string
}

// Traffic Light Protocol level → name.
export const TLP: Record<Tlp, string> = {
  0: 'white',
  1: 'green',
  2: 'amber',
  3: 'red',
}

// Analyst → [initials, avatar background]. Colours sampled from the
// prototype so avatars stay recognisable per person.
export const AV: Record<string, [string, string]> = {
  'J. Tanaka': ['JT', '#A8642F'],
  'P. Nguyen': ['PN', '#7D6A55'],
  'A. Whitford': ['AW', '#0E9F76'],
  'S. Iyer': ['SI', '#7A5C44'],
  Unassigned: ['—', '#54463A'],
}

export const avatarFor = (name: string): [string, string] =>
  AV[name] ?? ['?', '#54463A']

// A tag like "T1528" / "T1071.004" is a MITRE ATT&CK technique — it
// gets the accent-coloured chip treatment.

export const initialCases: Case[] = [
  {
    id: '#1842',
    sev: 3,
    tlp: 2,
    status: 'inprogress',
    statusName: 'In progress',
    title: 'OAuth consent grant — privileged account compromise',
    assignee: 'J. Tanaka',
    tags: ['T1528', 'identity', 'bec'],
    tasksDone: 3,
    tasksTotal: 7,
    updated: '8m',
  },
  {
    id: '#1841',
    sev: 4,
    tlp: 3,
    status: 'open',
    statusName: 'Open',
    title: 'Ransomware staging on FILESRV-AU02',
    assignee: 'P. Nguyen',
    tags: ['T1486'],
    tasksDone: 1,
    tasksTotal: 6,
    updated: '21m',
  },
  {
    id: '#1839',
    sev: 3,
    tlp: 2,
    status: 'inprogress',
    statusName: 'In progress',
    title: 'Beaconing from OT jump host — rare destination',
    assignee: 'A. Whitford',
    tags: ['T1071', 'ot'],
    tasksDone: 2,
    tasksTotal: 5,
    updated: '1h',
  },
  {
    id: '#1836',
    sev: 2,
    tlp: 1,
    status: 'waiting',
    statusName: 'Waiting',
    title: 'Local admin created outside change window',
    assignee: 'S. Iyer',
    tags: ['T1136'],
    tasksDone: 2,
    tasksTotal: 3,
    updated: '3h',
  },
  {
    id: '#1834',
    sev: 3,
    tlp: 2,
    status: 'inprogress',
    statusName: 'In progress',
    title: 'Credential phish — retail billing team',
    assignee: 'J. Tanaka',
    tags: ['phishing'],
    tasksDone: 4,
    tasksTotal: 6,
    updated: '4h',
  },
  {
    id: '#1830',
    sev: 2,
    tlp: 1,
    status: 'waiting',
    statusName: 'Waiting',
    title: 'DNS TXT exfil pattern from CI runners',
    assignee: 'Unassigned',
    tags: ['T1071.004'],
    tasksDone: 0,
    tasksTotal: 4,
    updated: '6h',
  },
  {
    id: '#1827',
    sev: 1,
    tlp: 0,
    status: 'resolved',
    statusName: 'Resolved',
    title: 'EDR coverage gap — 6 laptops offline',
    assignee: 'S. Iyer',
    tags: ['hygiene'],
    tasksDone: 3,
    tasksTotal: 3,
    updated: '1d',
  },
  {
    id: '#1788',
    sev: 2,
    tlp: 1,
    status: 'resolved',
    statusName: 'Resolved',
    title: 'Phish campaign — fake billing portal',
    assignee: 'P. Nguyen',
    tags: ['phishing'],
    tasksDone: 5,
    tasksTotal: 5,
    updated: '6d',
  },
]
