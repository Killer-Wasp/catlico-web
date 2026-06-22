export type MemberPublic = { user_id: string; email: string }

// No name is stored on the user, so derive a display name from the email's
// local part: "j.tanaka@x" -> "J. Tanaka", "analyst-a@x" -> "Analyst A".
export function displayName(email: string): string {
  const local = email.split('@')[0] ?? email
  const parts = local.split(/[.\-_]+/).filter(Boolean)
  if (!parts.length) return email
  return parts
    .map((p) =>
      p.length === 1 ? `${p.toUpperCase()}.` : p[0].toUpperCase() + p.slice(1),
    )
    .join(' ')
}

export function memberDisplayNameById(members: MemberPublic[] = []) {
  return new Map(
    members.map((member) => [member.user_id, displayName(member.email)]),
  )
}
