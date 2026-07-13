import type { ReactNode } from 'react'
import { Code as MantineCode, Text } from '@mantine/core'

/**
 * InlineMarkdown — inline-only Markdown for short, single-block copy such as an
 * alert description. Supports font-level marks only: **bold**, *italic* / _italic_
 * and `inline code`, plus newlines. It intentionally does NOT render block
 * structure (headings, lists, tables) so alert copy stays a compact blurb.
 *
 * Safe by construction: the string is tokenised and every token becomes a React
 * node — it never uses `dangerouslySetInnerHTML`.
 */

// Order matters: bold (**/__) is tried before italic (*/_) so `**x**` is not
// mis-read as two italic runs. Non-greedy bodies keep adjacent runs separate.
const INLINE = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`(.+?)`/g

// Split a plain-text run on newlines, inserting <br/> between the pieces.
function withBreaks(text: string, keyBase: string): ReactNode[] {
  const parts = text.split('\n')
  return parts.flatMap((part, i) =>
    i === 0 ? [part] : [<br key={`${keyBase}-br-${i}`} />, part],
  )
}

export function InlineMarkdown({ text }: { text: string }): ReactNode {
  if (!text) return null

  const nodes: ReactNode[] = []
  let last = 0
  let key = 0
  let match: RegExpExecArray | null
  INLINE.lastIndex = 0

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(...withBreaks(text.slice(last, match.index), `t${key}`))
    }
    // Classify by the delimiter of the whole match: `**`/`__` bold, `` ` `` code,
    // a lone `*`/`_` italic. Reading the delimiter (rather than the capture
    // groups) keeps the run's inner text trivially in hand.
    const full = match[0]
    if (full.startsWith('**') || full.startsWith('__')) {
      nodes.push(
        <Text key={key} span fw={700} inherit>
          {full.slice(2, -2)}
        </Text>,
      )
    } else if (full.startsWith('`')) {
      nodes.push(
        <MantineCode key={key} fz="0.9em">
          {full.slice(1, -1)}
        </MantineCode>,
      )
    } else {
      nodes.push(
        <Text key={key} span fs="italic" inherit>
          {full.slice(1, -1)}
        </Text>,
      )
    }
    last = match.index + full.length
    key += 1
  }

  if (last < text.length) {
    nodes.push(...withBreaks(text.slice(last), 'tend'))
  }

  return <>{nodes}</>
}
