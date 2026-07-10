/**
 * MarkdownView.tsx — safe, read-only Markdown renderer for untrusted plugin output.
 *
 * Plugin `render_mode: 'markdown'` bodies are untrusted. This reuses the repo's
 * established safe path (see `case-detail/CaseDescription.tsx`): a borderless,
 * read-only Tiptap view. `@tiptap/markdown` parses the Markdown into the
 * ProseMirror schema and renders through React nodes — it never uses
 * `dangerouslySetInnerHTML`, so raw HTML in the payload cannot inject markup.
 * StarterKit + Markdown only; no link auto-linking beyond StarterKit defaults.
 */
import { RichTextEditor } from '@mantine/tiptap'
import { Markdown } from '@tiptap/markdown'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Text } from '@mantine/core'

export function MarkdownView({ markdown }: { markdown: string }) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: markdown,
    contentType: 'markdown',
    editable: false,
    // TanStack Start renders on the server first; defer to the client to avoid
    // a hydration mismatch (same as CaseDescription).
    immediatelyRender: false,
  })

  // Before the editor mounts on the client, fall back to plain text so the
  // content is never missing and never rendered as raw HTML.
  if (!editor) {
    return (
      <Text fz={13} style={{ whiteSpace: 'pre-wrap' }}>
        {markdown}
      </Text>
    )
  }

  return (
    <RichTextEditor
      editor={editor}
      styles={{
        root: { border: 'none' },
        content: { padding: 0, background: 'transparent' },
      }}
    >
      <RichTextEditor.Content />
    </RichTextEditor>
  )
}
