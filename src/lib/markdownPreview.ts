/**
 * markdownPreview — collapse a Markdown string to a short, single-line plain-text
 * snippet for dense UI (table cells, list subtitles) where a full rich render
 * would be noise. Takes the first non-empty line and strips the common inline /
 * block markers so `**Objective:** do X` reads as `Objective: do X`.
 */
export function markdownPreview(markdown: string | null | undefined): string {
  if (!markdown) return ''
  const firstLine =
    markdown
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ''
  return firstLine
    .replace(/^#+\s*/, '') // headings
    .replace(/^>\s*/, '') // blockquote
    .replace(/^[-*]\s+\[[ xX]\]\s*/, '') // task-list item
    .replace(/^[-*+]\s+/, '') // bullet
    .replace(/^\d+\.\s+/, '') // ordered item
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold **
    .replace(/__(.+?)__/g, '$1') // bold __
    .replace(/\*(.+?)\*/g, '$1') // italic *
    .replace(/_(.+?)_/g, '$1') // italic _
    .replace(/`(.+?)`/g, '$1') // inline code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links → text
    .trim()
}
