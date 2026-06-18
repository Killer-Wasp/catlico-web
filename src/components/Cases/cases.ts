// Avatar helpers for the Cases views — initials + a stable colour per analyst.

// Analyst → [initials, avatar background]. Colours sampled from the
// prototype so avatars stay recognisable per person.
export const AV: Record<string, [string, string]> = {
  'J. Tanaka': ['JT', '#A8642F'],
  'P. Nguyen': ['PN', '#7D6A55'],
  'A. Whitford': ['AW', '#0E9F76'],
  'S. Iyer': ['SI', '#7A5C44'],
  Unassigned: ['—', '#54463A'],
}

// Palette for assignees not in the static AV map (e.g. backend users keyed by
// email) — colour is picked deterministically so a person keeps the same one.
const AVATAR_COLORS = [
  '#A8642F',
  '#7D6A55',
  '#0E9F76',
  '#7A5C44',
  '#2E6FA8',
  '#8C5BA8',
]

// Derive [initials, colour] for a display name or email. "j.tanaka@catlico.io"
// → ["JT", colour]; "P. Nguyen" → ["PN", colour].
function deriveAvatar(name: string): [string, string] {
  const local = name.split('@')[0]
  const parts = local.split(/[.\-_\s]+/).filter(Boolean)
  const initials = (
    parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  ).toUpperCase()
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return [initials || '?', AVATAR_COLORS[hash % AVATAR_COLORS.length]]
}

export const avatarFor = (name: string): [string, string] =>
  AV[name] ?? deriveAvatar(name)

