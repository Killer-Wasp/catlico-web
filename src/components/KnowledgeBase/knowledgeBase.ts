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
    blocks: [
      {
        type: 'section',
        title: '1 · Triage',
        items: [
          'Pull the raw .eml via M365 message trace.',
          'Capture headers, body, attachments and links.',
          'Confirm the lure is real and in-scope.',
        ],
      },
      {
        type: 'section',
        title: '2 · Scope',
        items: [
          'Query mail flow for all recipients.',
          'Correlate proxy/URL telemetry for clickers.',
          'Identify any credential submissions.',
        ],
      },
      {
        type: 'section',
        title: '3 · Contain',
        items: [
          'Block sender, domain and landing URLs.',
          'Reset credentials + revoke sessions for submitters.',
          'Purge the message from mailboxes.',
        ],
      },
      {
        type: 'paragraph',
        text: 'Apply the case template to auto-create these tasks.',
        code: 'Phishing / credential harvesting',
      },
    ],
  },
  {
    id: 'kb-bec',
    title: 'BEC investigation guide',
    author: 'A. Whitford',
    updated: '1 week ago',
    tags: ['runbook', 'bec', 'finance'],
    summary:
      'For confirmed or suspected business email compromise — mailbox rule abuse, payment redirection, executive impersonation.',
    blocks: [
      {
        type: 'section',
        title: 'Immediate actions',
        items: [
          'Audit inbox rules and forwarding on impacted mailboxes.',
          'Revoke sessions and reset credentials.',
          'Notify finance to freeze at-risk payments.',
        ],
      },
      {
        type: 'section',
        title: 'Evidence to preserve',
        items: [
          'Unified audit log for the access window.',
          'Rule definitions (as added evidence).',
          'Invoice + payment activity.',
        ],
      },
    ],
  },
  {
    id: 'kb-tlp',
    title: 'TLP & PAP handling policy',
    author: 'J. Tanaka',
    updated: '3 weeks ago',
    tags: ['policy'],
    summary:
      'Traffic Light Protocol governs who may see an artifact; Permissible Actions Protocol governs what may be done with it.',
    blocks: [
      {
        type: 'list',
        items: [
          'WHITE (0) — unrestricted.',
          'GREEN (1) — community.',
          'AMBER (2) — limited distribution (default).',
          'RED (3) — named recipients only.',
        ],
      },
      {
        type: 'paragraph',
        text: "Analyzers and responders must respect an observable's PAP — egress is blocked when an action would exceed the permitted level.",
      },
    ],
  },
  {
    id: 'kb-onboard',
    title: 'Analyst onboarding checklist',
    author: 'J. Tanaka',
    updated: '1 month ago',
    tags: ['onboarding'],
    summary: '',
    blocks: [
      {
        type: 'list',
        items: [
          'Account provisioned with the analyst profile.',
          'MFA enrolled (phishing-resistant).',
          'Read the phishing, BEC and malware runbooks.',
          'Shadow a shift on the triage queue.',
          'Complete a supervised case end-to-end.',
        ],
      },
    ],
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
    blocks: [{ type: 'paragraph', text: 'New page - start writing...' }],
  }
}
