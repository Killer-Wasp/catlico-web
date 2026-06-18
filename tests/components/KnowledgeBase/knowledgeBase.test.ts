import {
  createDraftKnowledgeBasePage,
  getKnowledgeBasePage,
  initialKnowledgeBasePages,
} from '#/components/KnowledgeBase/knowledgeBase'
import { describe, expect, test } from 'vitest'

describe('knowledge base data helpers', () => {
  test('keeps the prototype page list in order', () => {
    expect(initialKnowledgeBasePages.map((page) => page.title)).toEqual([
      'Phishing response runbook',
      'BEC investigation guide',
      'TLP & PAP handling policy',
      'Analyst onboarding checklist',
    ])
  })

  test('finds a selected page or falls back to the first page', () => {
    expect(getKnowledgeBasePage(initialKnowledgeBasePages, 'kb-bec').title).toBe(
      'BEC investigation guide',
    )
    expect(getKnowledgeBasePage(initialKnowledgeBasePages, 'missing').title).toBe(
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
