// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  COMMENT_HIGHLIGHT_CLASS,
  CommentsPanel,
} from './CommentsPanel'

// --- Mocks: keep the panel light. We only care about the comment list + the
// scroll/highlight behaviour, not the tiptap editor or the network.
// (vi.mock calls are hoisted above these imports by vitest.) ---

const initialComments = [
  { id: 'c-1', author: 'Ann', time: '10:00', body: 'first comment' },
  { id: 'c-2', author: 'Bob', time: '10:05', body: 'second comment' },
  { id: 'c-3', author: 'Cy', time: '10:10', body: 'third comment' },
]

// Mutable holder so a test can swap the comment list identity mid-flight,
// simulating a refetch (refetchOnWindowFocus, mutation invalidation, …).
const store = vi.hoisted(() => ({
  comments: [] as { id: string; author: string; time: string; body: string }[],
}))

vi.mock('@tanstack/react-query', () => ({
  queryOptions: (o: unknown) => o,
  useQuery: (options: { queryKey: unknown[] }) => {
    const key = options.queryKey
    if (Array.isArray(key) && key.includes('mentionable')) {
      return { data: [] }
    }
    return { data: store.comments }
  },
  useMutation: () => ({ mutate: vi.fn() }),
  useQueryClient: () => ({}),
}))

vi.mock('@tiptap/react', () => ({ useEditor: () => null }))

vi.mock('@mantine/tiptap', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>
  const Noop = () => null
  const RichTextEditor = Object.assign(Passthrough, {
    Toolbar: Passthrough,
    ControlsGroup: Passthrough,
    Content: Noop,
    Bold: Noop,
    Italic: Noop,
    Strikethrough: Noop,
    ClearFormatting: Noop,
    Code: Noop,
    BulletList: Noop,
    OrderedList: Noop,
    Blockquote: Noop,
    CodeBlock: Noop,
    Link: Noop,
    Unlink: Noop,
  })
  return { RichTextEditor }
})

const scrollIntoView = vi.fn()

beforeEach(() => {
  scrollIntoView.mockClear()
  Element.prototype.scrollIntoView = scrollIntoView
  store.comments = initialComments
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderPanel(props: { caseId: string; highlightCommentId?: string }) {
  return render(
    <MantineProvider>
      <CommentsPanel {...props} />
    </MantineProvider>,
  )
}

describe('CommentsPanel comment deep-link', () => {
  test('each comment has a stable dom anchor id', () => {
    renderPanel({ caseId: '1' })
    expect(document.getElementById('comment-c-1')).not.toBeNull()
    expect(document.getElementById('comment-c-2')).not.toBeNull()
  })

  test('scrolls the targeted comment into view and highlights it', async () => {
    renderPanel({ caseId: '1', highlightCommentId: 'c-2' })
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
    const el = document.getElementById('comment-c-2')
    expect(el?.className).toContain(COMMENT_HIGHLIGHT_CLASS)
  })

  test('without the param nothing is scrolled or highlighted', () => {
    renderPanel({ caseId: '1' })
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(
      document.querySelector(`.${COMMENT_HIGHLIGHT_CLASS}`),
    ).toBeNull()
  })

  test('an unknown comment id highlights nothing', () => {
    renderPanel({ caseId: '1', highlightCommentId: 'c-999' })
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(
      document.querySelector(`.${COMMENT_HIGHLIGHT_CLASS}`),
    ).toBeNull()
  })

  test('the highlight clears after the transient window', async () => {
    vi.useFakeTimers()
    renderPanel({ caseId: '1', highlightCommentId: 'c-2' })
    // effect runs synchronously on mount
    expect(
      document.getElementById('comment-c-2')?.className,
    ).toContain(COMMENT_HIGHLIGHT_CLASS)
    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(
      document.getElementById('comment-c-2')?.className,
    ).not.toContain(COMMENT_HIGHLIGHT_CLASS)
  })

  test('a comments refetch mid-window still clears the highlight', () => {
    vi.useFakeTimers()
    const { rerender } = renderPanel({
      caseId: '1',
      highlightCommentId: 'c-2',
    })
    expect(
      document.getElementById('comment-c-2')?.className,
    ).toContain(COMMENT_HIGHLIGHT_CLASS)

    // Partway through the highlight window, a refetch swaps the comment list
    // for a new array identity and the component re-renders.
    act(() => {
      vi.advanceTimersByTime(500)
    })
    store.comments = initialComments.map((c) => ({ ...c }))
    act(() => {
      rerender(
        <MantineProvider>
          <CommentsPanel caseId="1" highlightCommentId="c-2" />
        </MantineProvider>,
      )
    })

    // Past the full window: the timer (owned by its own effect) must have
    // survived the refetch and cleared the highlight.
    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(
      document.getElementById('comment-c-2')?.className,
    ).not.toContain(COMMENT_HIGHLIGHT_CLASS)
  })
})
