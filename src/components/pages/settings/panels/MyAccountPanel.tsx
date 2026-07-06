import { UserAvatar } from '#/components/Users/UserAvatar'
import {
  currentUserKeys,
  currentUserQueryOptions,
  removeAvatar,
  updateProfile,
  uploadAvatar,
} from '#/lib/auth/userQueries'
import {
  Avatar,
  Box,
  Button,
  Divider,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { LoadingPanel, Panel } from '#/components/pages/settings/settingsUi'

function notifyError(fallback: string) {
  return (error: unknown) =>
    notifications.show({
      color: 'red',
      message: error instanceof Error ? error.message : fallback,
    })
}

export function MyAccountPanel() {
  const queryClient = useQueryClient()
  const { data: user, isPending } = useQuery(currentUserQueryOptions())

  const fileRef = useRef<HTMLInputElement>(null)
  // A just-uploaded picture shown straight from the chosen file, so the preview
  // updates instantly without fighting the avatar endpoint's browser cache.
  const [localPreview, setLocalPreview] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name ?? '')
    setLastName(user.last_name ?? '')
    setEmail(user.email)
  }, [user])

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    },
    [localPreview],
  )

  const cacheUpdated = (updated: NonNullable<typeof user>) => {
    queryClient.setQueryData(currentUserKeys.me, updated)
    queryClient.invalidateQueries({ queryKey: currentUserKeys.me })
  }

  const nameMutation = useMutation({
    mutationFn: () =>
      updateProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
      }),
    onSuccess: (updated) => {
      cacheUpdated(updated)
      notifications.show({ color: 'green', message: 'Profile updated' })
    },
    onError: notifyError('Unable to update profile'),
  })

  const credentialsMutation = useMutation({
    mutationFn: () =>
      updateProfile({
        ...(user && email !== user.email ? { email } : {}),
        ...(newPassword ? { new_password: newPassword } : {}),
        current_password: currentPassword,
      }),
    onSuccess: (updated) => {
      cacheUpdated(updated)
      setCurrentPassword('')
      setNewPassword('')
      notifications.show({ color: 'green', message: 'Credentials updated' })
    },
    onError: notifyError('Unable to update credentials'),
  })

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: (updated, file) => {
      cacheUpdated(updated)
      setLocalPreview(URL.createObjectURL(file))
      notifications.show({ color: 'green', message: 'Profile picture updated' })
    },
    onError: notifyError('Unable to upload picture'),
  })

  const removeMutation = useMutation({
    mutationFn: () => removeAvatar(),
    onSuccess: (updated) => {
      cacheUpdated(updated)
      setLocalPreview(null)
      notifications.show({ color: 'green', message: 'Profile picture removed' })
    },
    onError: notifyError('Unable to remove picture'),
  })

  if (isPending || !user) {
    return <LoadingPanel label="Loading account..." />
  }

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    // Let the same file be re-picked later (e.g. after an error).
    event.currentTarget.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notifications.show({
        color: 'red',
        message: 'Profile picture must be an image',
      })
      return
    }
    avatarMutation.mutate(file)
  }

  // Changing email or password requires the current password (backend rule).
  const credentialsDirty = email !== user.email || newPassword.length > 0
  const nameDirty =
    firstName.trim() !== (user.first_name ?? '') ||
    lastName.trim() !== (user.last_name ?? '')

  return (
    <Panel title="My account">
      <Box p={18}>
        <Stack gap="xl">
          <div>
            <Text fw={600} mb="xs">
              Profile picture
            </Text>
            <Group>
              {localPreview ? (
                <Avatar src={localPreview} size={72} radius="xl" />
              ) : (
                <UserAvatar user={user} size={72} />
              )}
              <Stack gap={6}>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="default"
                    loading={avatarMutation.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    {user.has_avatar ? 'Change picture' : 'Upload picture'}
                  </Button>
                  {user.has_avatar && (
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      loading={removeMutation.isPending}
                      onClick={() => removeMutation.mutate()}
                    >
                      Remove
                    </Button>
                  )}
                </Group>
                <Text fz={11} c="dimmed">
                  PNG, JPG or GIF. Shown next to your name across the app.
                </Text>
              </Stack>
            </Group>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickFile}
            />
          </div>

          <Divider />

          <div>
            <Text fw={600} mb="xs">
              Name
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.currentTarget.value)}
              />
              <TextInput
                label="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.currentTarget.value)}
              />
            </SimpleGrid>
            <Group justify="flex-end" mt="md">
              <Button
                color="orange"
                loading={nameMutation.isPending}
                disabled={!nameDirty}
                onClick={() => nameMutation.mutate()}
              >
                Save name
              </Button>
            </Group>
          </div>

          <Divider />

          <div>
            <Text fw={600} mb="xs">
              Email &amp; password
            </Text>
            <Stack gap="md">
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <PasswordInput
                  label="New password"
                  placeholder="Leave blank to keep current"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.currentTarget.value)}
                />
                <PasswordInput
                  label="Current password"
                  description="Required to change email or password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                />
              </SimpleGrid>
            </Stack>
            <Group justify="flex-end" mt="md">
              <Button
                color="orange"
                loading={credentialsMutation.isPending}
                disabled={!credentialsDirty || !currentPassword}
                onClick={() => credentialsMutation.mutate()}
              >
                Update credentials
              </Button>
            </Group>
          </div>
        </Stack>
      </Box>
    </Panel>
  )
}
