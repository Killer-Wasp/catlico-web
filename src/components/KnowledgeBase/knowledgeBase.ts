import type { KnowledgeBasePage } from './knowledgeBase.types'

export const initialKnowledgeBasePages: KnowledgeBasePage[] = [
  {
    id: 'kb-phish',
    title: 'Phishing response runbook',
    author: 'P. Nguyen',
    updated: '2 days ago',
    tags: ['runbook', 'phishing'],
    summary:
      'Standard operating procedure for credential-harvesting phishing reported via the abuse mailbox or detected by Proofpoint TAP.',
    content:
      '## 1 · Triage\n\n- Pull the raw .eml via M365 message trace.\n- Capture headers, body, attachments and links.\n- Confirm the lure is real and in-scope.\n\n## 2 · Scope\n\n- Query mail flow for all recipients.\n- Correlate proxy/URL telemetry for clickers.\n- Identify any credential submissions.\n\n## 3 · Contain\n\n- Block sender, domain and landing URLs.\n- Reset credentials + revoke sessions for submitters.\n- Purge the message from mailboxes.\n\nApply the case template to auto-create these tasks.\n\n```\nPhishing / credential harvesting\n```',
  },
  {
    id: 'kb-bec',
    title: 'BEC investigation guide',
    author: 'A. Whitford',
    updated: '1 week ago',
    tags: ['runbook', 'bec', 'finance'],
    summary:
      'For confirmed or suspected business email compromise — mailbox rule abuse, payment redirection, executive impersonation.',
    content:
      '## Immediate actions\n\n- Audit inbox rules and forwarding on impacted mailboxes.\n- Revoke sessions and reset credentials.\n- Notify finance to freeze at-risk payments.\n\n## Evidence to preserve\n\n- Unified audit log for the access window.\n- Rule definitions (as added evidence).\n- Invoice + payment activity.',
  },
  {
    id: 'kb-tlp',
    title: 'TLP & PAP handling policy',
    author: 'J. Tanaka',
    updated: '3 weeks ago',
    tags: ['policy'],
    summary:
      'Traffic Light Protocol governs who may see an artifact; Permissible Actions Protocol governs what may be done with it.',
    content:
      "- WHITE (0) — unrestricted.\n- GREEN (1) — community.\n- AMBER (2) — limited distribution (default).\n- RED (3) — named recipients only.\n\nAnalyzers and responders must respect an observable's PAP — egress is blocked when an action would exceed the permitted level.",
  },
  {
    id: 'kb-onboard',
    title: 'Analyst onboarding checklist',
    author: 'J. Tanaka',
    updated: '1 month ago',
    tags: ['onboarding'],
    summary: '',
    content:
      '- Account provisioned with the analyst profile.\n- MFA enrolled (phishing-resistant).\n- Read the phishing, BEC and malware runbooks.\n- Shadow a shift on the triage queue.\n- Complete a supervised case end-to-end.',
  },
]

export function getKnowledgeBasePage(
  pages: KnowledgeBasePage[],
  selectedId: string,
) {
  return pages.find((page) => page.id === selectedId) ?? pages[0]
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function createDraftKnowledgeBasePage(title: string): KnowledgeBasePage {
  return {
    id: `kb-${slugify(title) || Date.now().toString(36)}`,
    title,
    author: 'J. Tanaka',
    updated: 'just now',
    tags: ['draft'],
    summary: 'New page - start writing...',
    content: 'New page - start writing...',
  }
}
