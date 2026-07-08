import { Text, Tooltip } from '@mantine/core'
import type { TextProps } from '@mantine/core'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import type { ReactNode } from 'react'

dayjs.extend(relativeTime)

export function relativeTimeLabel(iso: string | undefined, fallback = '—') {
  return iso ? dayjs(iso).fromNow() : fallback
}

export function localDateTimeLabel(iso: string) {
  return dayjs(iso).format('DD MMM YYYY, h:mm A')
}

type RelativeTimeProps = Omit<TextProps, 'children'> & {
  iso?: string
  fallback?: string
  suffix?: ReactNode
}

export function RelativeTime({
  iso,
  fallback,
  suffix,
  ...textProps
}: RelativeTimeProps) {
  const text = (
    <Text component="span" {...textProps}>
      {relativeTimeLabel(iso, fallback)}
      {suffix}
    </Text>
  )

  if (!iso) return text

  return (
    <Tooltip label={localDateTimeLabel(iso)} withArrow>
      {text}
    </Tooltip>
  )
}
