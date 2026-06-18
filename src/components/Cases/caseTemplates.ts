import type { Pap, Severity, Tlp } from '#/lib/domain'
import type {
  CaseTemplate,
  CaseTemplateFilter,
  CaseTemplateTask,
  NewCaseCustomField,
} from './caseTemplates.types'

const task = (
  title: string,
  group: string,
  description: string,
  dueInHours: number,
  assignee = '',
  flagged = false,
): CaseTemplateTask => ({
  title,
  group,
  description,
  assignee,
  dueInHours,
  flagged,
})

export const caseTemplatesList: CaseTemplate[] = [
  {
    id: 'generic',
    name: 'Generic investigation',
    builtin: true,
    updated: 'baseline',
    description:
      "Open-ended investigation skeleton for incidents that don't fit a more specific playbook.",
    prefix: '',
    assignee: '',
    sev: 2,
    tlp: 2,
    pap: 2,
    tags: [],
    tasks: [
      task(
        'Initial triage and scoping',
        'Triage',
        "Confirm the alert is real, define what's in/out of scope, and decide severity.",
        2,
      ),
      task(
        'Collect and preserve evidence',
        'Investigation',
        'Snapshot logs, artefacts, and any volatile data before it rotates.',
        8,
      ),
      task(
        'Document findings',
        'Investigation',
        "Write up what happened, what you saw, and what's still unknown.",
        24,
      ),
      task(
        'Close-out review',
        'Closure',
        'Lessons learnt, action items, and confirm containment is stable.',
        48,
      ),
    ],
    customFields: [],
  },
  {
    id: 'phishing',
    name: 'Phishing / credential harvesting',
    builtin: true,
    updated: '3 days ago',
    description:
      'Standard playbook for credential-harvesting phishing and consent-grant lures.',
    prefix: '[Phishing] ',
    assignee: 'P. Nguyen',
    sev: 2,
    tlp: 2,
    pap: 2,
    tags: ['phishing', 'T1566'],
    tasks: [
      task(
        'Pull full message + headers',
        'Triage',
        'Grab the raw .eml from the first reporter or via M365 message trace. Capture headers, body, attachments, links.',
        1,
        'P. Nguyen',
        true,
      ),
      task(
        'Identify recipients and clickers',
        'Scoping',
        'Query mail flow for everyone who received the message; correlate with proxy/URL telemetry for clickers.',
        2,
        'P. Nguyen',
      ),
      task(
        'Block sender / domain / URL',
        'Containment',
        'Add sender, domain, and any landing URLs to the mail gateway + proxy blocklists.',
        3,
      ),
      task(
        'Reset credentials for submitters',
        'Containment',
        'For each user who submitted credentials: force password reset, revoke sessions, audit MFA registrations.',
        4,
        'J. Tanaka',
        true,
      ),
      task(
        'Purge message from mailboxes',
        'Eradication',
        "Soft-delete the message from all recipient mailboxes via the mail platform's quarantine tooling.",
        8,
      ),
      task(
        'User notification',
        'Closure',
        'Notify reporters, submitters, and managers. Include awareness reminder.',
        24,
      ),
    ],
    customFields: [
      {
        key: 'affected_users',
        label: 'Affected users',
        type: 'integer',
        defaultValue: '',
      },
      {
        key: 'campaign_id',
        label: 'Campaign ID',
        type: 'string',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'bec',
    name: 'Business email compromise',
    builtin: true,
    updated: '1 week ago',
    description:
      'For confirmed or suspected BEC — mailbox rule abuse, payment redirection, executive impersonation.',
    prefix: '[BEC] ',
    assignee: 'A. Whitford',
    sev: 3,
    tlp: 3,
    pap: 2,
    tags: ['bec', 'T1078', 'finance'],
    tasks: [
      task(
        'Audit mailbox rules and forwarding',
        'Investigation',
        'Enumerate inbox rules and forwarding on the impacted mailboxes. Capture suspicious rules.',
        1,
        'A. Whitford',
        true,
      ),
      task(
        'Revoke sessions + reset credentials',
        'Containment',
        "Force sign-out, revoke refresh tokens, reset credentials, and re-enrol MFA.",
        2,
        'J. Tanaka',
        true,
      ),
      task(
        'Review financial transactions at risk',
        'Investigation',
        'Pull invoice and payment activity for the period the attacker had access.',
        4,
      ),
      task(
        'Notify finance and freeze payments',
        'Containment',
        'Loop in the finance lead so pending payments can be paused for verification.',
        4,
        '',
        true,
      ),
      task(
        'Hunt for related consent grants',
        'Investigation',
        "Pivot on the actor's app ids and sign-in IPs across the tenant in the last 30 days.",
        24,
      ),
      task(
        'Executive comms',
        'Closure',
        'Draft an executive summary covering scope, financial exposure, and remediation.',
        48,
      ),
    ],
    customFields: [
      {
        key: 'financial_exposure',
        label: 'Financial exposure (AUD)',
        type: 'integer',
        defaultValue: '',
      },
      {
        key: 'executive_impersonated',
        label: 'Executive impersonated',
        type: 'string',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'malware',
    name: 'Malware / ransomware',
    builtin: true,
    updated: '2 weeks ago',
    description:
      'Endpoint malware including commodity loaders, RATs, and confirmed ransomware events.',
    prefix: '[Malware] ',
    assignee: 'J. Tanaka',
    sev: 3,
    tlp: 2,
    pap: 2,
    tags: ['malware', 'T1059'],
    tasks: [
      task(
        'Isolate affected host(s)',
        'Containment',
        'Network-contain the impacted endpoints via EDR. Preserve evidence by leaving them powered.',
        1,
        'J. Tanaka',
        true,
      ),
      task(
        'Capture triage image / memory',
        'Forensics',
        'Capture KAPE triage + memory image before any cleanup. Upload to evidence store.',
        4,
      ),
      task(
        'Identify initial access vector',
        'Investigation',
        'Determine how the malware got in. Document the chain.',
        8,
      ),
      task(
        'Hunt for lateral movement',
        'Investigation',
        'Pivot on hashes and IOCs across the fleet.',
        8,
      ),
      task(
        'Eradicate persistence',
        'Eradication',
        "Remove services, scheduled tasks, run keys, etc. Re-image if persistence can't be cleaned cleanly.",
        24,
      ),
      task(
        'Restore from known-good backup',
        'Recovery',
        'Validate backup integrity and restore. Confirm baseline before returning the host to service.',
        48,
      ),
    ],
    customFields: [
      {
        key: 'hosts_affected',
        label: 'Hosts affected',
        type: 'integer',
        defaultValue: '',
      },
      {
        key: 'malware_family',
        label: 'Malware family',
        type: 'string',
        defaultValue: '',
      },
    ],
  },
  {
    id: 'insider',
    name: 'Insider threat',
    builtin: true,
    updated: '3 weeks ago',
    description:
      'Suspicious behaviour from internal users — exfiltration, sabotage, or pre-departure risk.',
    prefix: '[Insider] ',
    assignee: 'S. Iyer',
    sev: 2,
    tlp: 3,
    pap: 3,
    tags: ['insider', 'T1078'],
    tasks: [
      task(
        'Engage HR / legal before action',
        'Scoping',
        'Insider cases require HR/legal sign-off before any user-facing action.',
        1,
        'S. Iyer',
        true,
      ),
      task(
        'Preserve audit logs',
        'Forensics',
        'Snapshot all relevant log sources before retention rotates.',
        4,
        '',
        true,
      ),
      task(
        'Review data access patterns',
        'Investigation',
        "Baseline normal access; identify what's anomalous.",
        24,
      ),
      task(
        'Restrict access (least privilege)',
        'Containment',
        "Pare back the user's access to the minimum required, coordinated with HR.",
        24,
      ),
      task(
        'Interview support documentation',
        'Closure',
        'Prepare evidence pack for the interview or disciplinary process.',
        72,
      ),
    ],
    customFields: [
      {
        key: 'hr_case_id',
        label: 'HR case ID',
        type: 'string',
        defaultValue: '',
      },
    ],
  },
]

const mandatoryOrgFields: NewCaseCustomField[] = [
  {
    key: 'data_classification',
    label: 'Data classification',
    type: 'string',
    defaultValue: '',
    mandatory: true,
  },
]

export function getCaseTemplate(id: string | null | undefined) {
  return caseTemplatesList.find((template) => template.id === id)
}

export function buildCustomFieldsForTemplate(
  templateId: string,
): NewCaseCustomField[] {
  const templateFields =
    getCaseTemplate(templateId)?.customFields.map((field) => ({
      ...field,
      mandatory:
        mandatoryOrgFields.find((mandatory) => mandatory.label === field.label)
          ?.mandatory ?? false,
    })) ?? []

  const missingMandatoryFields = mandatoryOrgFields.filter(
    (mandatory) =>
      !templateFields.some((field) => field.label === mandatory.label),
  )

  return [...templateFields, ...missingMandatoryFields]
}

export function formatTemplateDue(hours: number) {
  return hours < 24 ? `+${hours}h` : `+${Math.round(hours / 24)}d`
}

const severityLabels: Record<Severity, string> = {
  1: 'LOW',
  2: 'MEDIUM',
  3: 'HIGH',
  4: 'CRITICAL',
}

const trafficLabels: Record<Tlp | Pap, string> = {
  0: 'WHITE',
  1: 'GREEN',
  2: 'AMBER',
  3: 'RED',
}

export function severityTemplateLabel(severity: Severity) {
  return severityLabels[severity]
}

export function trafficTemplateLabel(value: Tlp | Pap) {
  return trafficLabels[value]
}

export function getCaseTemplateStats(template: CaseTemplate) {
  return {
    tasks: template.tasks.length,
    flagged: template.tasks.filter((taskItem) => taskItem.flagged).length,
    customFields: template.customFields.length,
  }
}

export function filterCaseTemplates(
  templates: CaseTemplate[],
  filter: CaseTemplateFilter,
) {
  if (filter === 'builtin') return templates.filter((template) => template.builtin)
  if (filter === 'custom') return templates.filter((template) => !template.builtin)
  return templates
}
