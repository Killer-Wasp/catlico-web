import {
  createDraftKnowledgeBasePage,
  getKnowledgeBasePage,
} from '#/components/KnowledgeBase/knowledgeBase'
import type { KnowledgeBasePage } from '#/components/KnowledgeBase/knowledgeBase.types'
import { describe, expect, test } from 'vitest'

describe('knowledge base data helpers', () => {
  const pages: KnowledgeBasePage[] = [
    {
      id: 'kb-phish',
      title: 'Phishing response runbook',
      author: 'P. Nguyen',
      updated: '2 days ago',
      tags: ['runbook', 'phishing'],
      summary: 'Phishing response steps.',
      content: '## Triage',
    },
    {
      id: 'kb-bec',
      title: 'BEC investigation guide',
      author: 'A. Whitford',
      updated: '1 week ago',
      tags: ['runbook', 'bec'],
      summary: 'BEC investigation steps.',
      content: '## Immediate actions',
    },
  ]

  test('finds a selected page or falls back to the first page', () => {
    expect(getKnowledgeBasePage(pages, 'kb-bec').title).toBe(
      'BEC investigation guide',
    )
    expect(getKnowledgeBasePage(pages, 'missing').title).toBe(
      'Phishing response runbook',
    )
  })

  test('creates a draft page with normalised id and starter content', () => {
    expect(createDraftKnowledgeBasePage('Threat Intel Notes')).toMatchObject({
      id: 'kb-threat-intel-notes',
      title: 'Threat Intel Notes',
      author: 'J. Tanaka',
      updated: 'just now',
      tags: ['draft'],
      summary: 'New page - start writing...',
    })
  })
})
