export type KnowledgeBaseBlock =
  | { type: 'paragraph'; text: string; code?: string }
  | { type: 'section'; title: string; items: string[] }
  | { type: 'list'; items: string[] }

export type KnowledgeBasePage = {
  id: string
  title: string
  author: string
  updated: string
  tags: string[]
  summary: string
  blocks: KnowledgeBaseBlock[]
}
