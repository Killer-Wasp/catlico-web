import type { CaseDetailTimelineEvent } from '#/components/Cases/caseDetails.types'
import { caseKeys, createCaseComment } from '#/components/Cases/casesQueries'
import { Box, Button, Group, Stack, Text, TextInput } from '@mantine/core'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { CasePanelHeader } from './CasePanelHeader'
import { actionNotice } from './constants'

const TIMELINE_MARKER: Record<'warn' | 'ok' | 'neutral' | 'comment', string> = {
  warn: 'var(--sev-high)',
  ok: 'var(--ok)',
  neutral: 'var(--muted)',
  comment: 'var(--mantine-color-blue-6)',
}

// Renders **bold** spans in timeline text without a full markdown parser.
function BoldText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
        index % 2 === 1 ? (
          <Text key={index} component="span" fw={700}>
            {part}
          </Text>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  )
}

export function TimelinePanel({
  timeline,
  caseId,
}: {
  timeline: CaseDetailTimelineEvent[]
  caseId: string
}) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [posting, setPosting] = useState(false)

  const markerColor = (event: CaseDetailTimelineEvent) =>
    event.kind === 'comment'
      ? TIMELINE_MARKER.comment
      : TIMELINE_MARKER[event.tone ?? 'neutral']

  // ponytail: inline comment key, dedup index when comment id absent
  let commentIndex = 0
  function eventKey(event: CaseDetailTimelineEvent) {
    if (event.kind === 'comment') return `comment-${commentIndex++}`
    return `audit-${event.createdAt}`
  }

  async function post() {
    const trimmed = note.trim()
    if (!trimmed || posting) return
    setPosting(true)
    try {
      await createCaseComment(caseId, trimmed)
      queryClient.invalidateQueries({ queryKey: caseKeys.fullDetail(caseId) })
      setNote('')
    } catch {
      actionNotice('Failed to post note')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Stack gap="md" p="lg">
      <CasePanelHeader label="Timeline" />

      <Box style={{ position: 'relative' }}>
        <Box
          style={{
            position: 'absolute',
            left: 6,
            top: 10,
            bottom: 10,
            width: 2,
            background: 'var(--line-soft)',
          }}
        />
        <Stack gap={0}>
          {timeline.map((event) => (
            <Group
              key={eventKey(event)}
              gap="md"
              align="flex-start"
              wrap="nowrap"
              py={10}
            >
              <Box
                w={14}
                h={14}
                mt={4}
                style={{
                  flexShrink: 0,
                  borderRadius: '50%',
                  border: `2px solid ${markerColor(event)}`,
                  background:
                    event.kind === 'comment'
                      ? markerColor(event)
                      : 'var(--mantine-color-body)',
                  zIndex: 1,
                }}
              />
              {event.kind === 'comment' ? (
                <Box flex={1} miw={0}>
                  <Group gap={8} mb={4}>
                    <Text fw={700}>{event.who}</Text>
                    <Text ff="monospace" fz={12} c="dimmed">
                      {event.when} AEST
                    </Text>
                  </Group>
                  <Text>{event.text}</Text>
                </Box>
              ) : (
                <Box>
                  <Text ff="monospace" fz={12} c="dimmed" mb={2}>
                    {event.when} AEST
                  </Text>
                  <Text>
                    {event.link ? (
                      <Text
                        component={Link}
                        to={event.link}
                        style={{ textDecoration: 'none', cursor: 'pointer' }}
                      >
                        <BoldText text={event.text} />
                      </Text>
                    ) : (
                      <BoldText text={event.text} />
                    )}{' '}
                    &middot;{' '}
                    <Text component="span" c="dimmed">
                      {event.who}
                    </Text>
                  </Text>
                </Box>
              )}
            </Group>
          ))}
        </Stack>
      </Box>

      <Group gap="sm" wrap="nowrap">
        <TextInput
          flex={1}
          placeholder="Add a note to the case log…"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              post()
            }
          }}
        />
        <Button variant="default" onClick={post} loading={posting}>
          Post
        </Button>
      </Group>
    </Stack>
  )
}
