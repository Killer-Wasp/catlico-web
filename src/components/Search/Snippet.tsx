import { Fragment } from 'react'
import { Mark } from '@mantine/core'

/**
 * Renders a ts_headline snippet. The backend delimits matches with literal
 * <mark>/</mark> markers; we split on them and render text nodes only —
 * content is never interpreted as HTML.
 */
export function Snippet({ text }: { text: string }) {
  const parts = text.split(/<\/?mark>/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <Mark key={i}>{part}</Mark> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  )
}
