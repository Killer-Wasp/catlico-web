import type { KnowledgeBasePagePublic } from '#/components/KnowledgeBase/knowledgeBaseQueries'

export type KBPage = {
  id: number
  title: string
  author: string
  updated: string
  tags: string[]
  summary: string
  content: string
  contributors: { id: string; email: string; lastEditedAt: string }[]
  lastEditedBy: { id: string; email: string; lastEditedAt: string } | null
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} days ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks} weeks ago`
  return `${Math.round(days / 30)} months ago`
}

export function fromApi(p: KnowledgeBasePagePublic): KBPage {
  return {
    id: p.id,
    title: p.title,
    author: p.created_by,
    updated: formatRelativeTime(p.updated_at ?? p.created_at),
    tags: p.tags,
    summary: p.summary,
    content: p.content,
    contributors: (p.contributors ?? []).map((contributor) => ({
      id: contributor.id,
      email: contributor.email,
      lastEditedAt: contributor.last_edited_at,
    })),
    lastEditedBy: p.last_edited_by
      ? {
          id: p.last_edited_by.id,
          email: p.last_edited_by.email,
          lastEditedAt: p.last_edited_by.last_edited_at,
        }
      : null,
  }
}
