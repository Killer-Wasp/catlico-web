import type { KnowledgeBasePage } from './knowledgeBase.types'

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
