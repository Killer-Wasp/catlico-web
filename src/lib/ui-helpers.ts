import { useEffect, useState } from 'react'

export function useStamp() {
  const [stamp, setStamp] = useState('')
  useEffect(() => {
    const now = new Date()
    const date = now.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Australia/Brisbane',
    })
    const time = now
      .toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Brisbane',
      })
      .toLowerCase()
    setStamp(`${date}, ${time} AEST`)
  }, [])
  return stamp
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed'
}
