import { avatarFor } from '#/components/Tasks/tasks'
import type { UserPublic } from '#/components/Users/usersQueries'
import { userDisplayName } from '#/components/Users/usersQueries'
import { api } from '#/lib/api/client'
import { Avatar } from '@mantine/core'
import { useEffect, useState } from 'react'

type UserAvatarProps = {
  // Only the identity fields the avatar needs — accepts a full `UserPublic` or
  // any lighter row (e.g. an org member) carrying the same fields.
  user: Pick<
    UserPublic,
    'id' | 'email' | 'first_name' | 'last_name' | 'has_avatar'
  >
  size?: number
}

/**
 * A user's profile picture. The avatar endpoint needs a Bearer token, so a bare
 * `<img src>` can't authenticate — we stream the blob through the API client and
 * hand Mantine an object URL. Falls back to colored initials when the user has
 * no picture.
 */
export function UserAvatar({ user, size = 22 }: UserAvatarProps) {
  const name = userDisplayName(user)
  const [initials, color] = avatarFor(name)
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!user.has_avatar) {
      setSrc(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    api
      .get(`users/${user.id}/avatar`)
      .blob()
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user.id, user.has_avatar])

  return (
    <Avatar src={src} color={color} size={size} radius="xl" alt={name}>
      {initials}
    </Avatar>
  )
}
