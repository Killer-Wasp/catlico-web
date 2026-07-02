/**
 * @-mention suggestions for the case description editor, backed by the org's
 * members. The popup is rendered outside the React tree by Tiptap's
 * `ReactRenderer`, so it can't read MantineProvider context — hence plain
 * elements styled with Mantine CSS variables rather than Mantine components.
 */
import type { MentionOptions } from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from '@tiptap/suggestion'
import { queryOptions } from '@tanstack/react-query'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { CSSProperties } from 'react'
import { avatarFor } from '#/components/Cases/cases'
import { displayName } from '#/components/Cases/caseUsers'
import type { MemberPublic } from '#/components/Cases/caseUsers'
import { api } from '#/lib/api/client'
import { getActiveOrgId } from '#/lib/auth/session'

/**
 * A mentionable person: `id` is the user id, `label` the display name (shown in
 * the picker and as the inserted `@mention`), `email` kept for search + avatar.
 */
export type MentionUser = { id: string; label: string; email: string }

async function fetchMentionableUsers(): Promise<MentionUser[]> {
  const orgId = getActiveOrgId()
  if (!orgId) return []
  const members = await api
    .get(`organisations/${orgId}/members`)
    .json<MemberPublic[]>()
  return members.map((m) => ({
    id: m.user_id,
    label: displayName(m.email),
    email: m.email,
  }))
}

/** The active org's members, for the @-mention picker. */
export const mentionableUsersQueryOptions = () =>
  queryOptions({
    queryKey: ['org', 'members', 'mentionable'] as const,
    queryFn: fetchMentionableUsers,
  })

// --- popup -----------------------------------------------------------------

type MentionListProps = SuggestionProps<MentionUser, MentionUser>
type MentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const menuStyle: CSSProperties = {
  minWidth: 220,
  maxHeight: 240,
  overflowY: 'auto',
  background: 'var(--mantine-color-body)',
  border: '1px solid var(--mantine-color-default-border)',
  borderRadius: 'var(--mantine-radius-sm)',
  boxShadow: 'var(--mantine-shadow-md)',
  padding: 4,
}

const itemStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  textAlign: 'left',
  padding: '5px 8px',
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--mantine-color-text)',
  background: active ? 'var(--mantine-color-default-hover)' : 'transparent',
})

const avatarStyle = (color: string): CSSProperties => ({
  flex: '0 0 auto',
  width: 24,
  height: 24,
  borderRadius: 999,
  background: color,
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const truncate: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const nameStyle: CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  ...truncate,
}

const subStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--mantine-color-dimmed)',
  fontFamily: 'var(--mantine-font-family-monospace)',
  ...truncate,
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  function MentionList(props, ref) {
    const [selected, setSelected] = useState(0)
    useEffect(() => setSelected(0), [props.items])

    const select = (index: number) => {
      const item = props.items.at(index)
      if (item) props.command(item)
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (!props.items.length) return false
        if (event.key === 'ArrowUp') {
          setSelected((s) => (s + props.items.length - 1) % props.items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelected((s) => (s + 1) % props.items.length)
          return true
        }
        if (event.key === 'Enter') {
          select(selected)
          return true
        }
        return false
      },
    }))

    if (!props.items.length) {
      return (
        <div style={menuStyle}>
          <div
            style={{
              ...itemStyle(false),
              color: 'var(--mantine-color-dimmed)',
            }}
          >
            No matching users
          </div>
        </div>
      )
    }

    return (
      <div style={menuStyle}>
        {props.items.map((item, index) => {
          const [initials, color] = avatarFor(item.email)
          return (
            <button
              key={item.id}
              type="button"
              // mousedown (not click) so the editor selection isn't lost first.
              onMouseDown={(event) => {
                event.preventDefault()
                select(index)
              }}
              onMouseEnter={() => setSelected(index)}
              style={itemStyle(index === selected)}
            >
              <span style={avatarStyle(color)}>{initials}</span>
              <span style={{ ...truncate, minWidth: 0 }}>
                <span style={nameStyle}>{item.label}</span>
                <span style={subStyle}>{item.email}</span>
              </span>
            </button>
          )
        })}
      </div>
    )
  },
)

/**
 * Build the Mention `suggestion` config. `getUsers` is read lazily on each
 * keystroke, so the picker reflects the latest fetched members without
 * recreating the editor. Note: the whole suggestion object replaces Mention's
 * default, so `char` and `command` are defined here too.
 */
export function mentionSuggestion(
  getUsers: () => MentionUser[],
): MentionOptions<MentionUser>['suggestion'] {
  return {
    char: '@',
    items: ({ query }) => {
      const q = query.toLowerCase()
      return getUsers()
        .filter((u) => u.label.toLowerCase().includes(q))
        .slice(0, 8)
    },
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'mention', attrs: { id: props.id, label: props.label } },
          { type: 'text', text: ' ' },
        ])
        .run()
    },
    render: () => {
      let component: ReactRenderer<MentionListHandle, MentionListProps> | null =
        null
      let popup: HTMLDivElement | null = null

      const place = (rect: DOMRect | null) => {
        if (!popup || !rect) return
        popup.style.left = `${rect.left}px`
        popup.style.top = `${rect.bottom + 4}px`
      }

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          })
          popup = document.createElement('div')
          popup.style.position = 'fixed'
          popup.style.zIndex = '300'
          popup.appendChild(component.element)
          document.body.appendChild(popup)
          place(props.clientRect?.() ?? null)
        },
        onUpdate: (props) => {
          component?.updateProps(props)
          place(props.clientRect?.() ?? null)
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            popup?.remove()
            return true
          }
          return component?.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          popup?.remove()
          popup = null
          component?.destroy()
          component = null
        },
      }
    },
  }
}
