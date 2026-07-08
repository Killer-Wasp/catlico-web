// Presentation helpers for the Alerts triage queue.
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

// Detection source → brand dot colour. Sampled from each vendor's mark
// in the prototype so the source column stays scannable at a glance.
export const SRC_COLORS: Record<string, string> = {
  'Defender XDR': '#2E8CF0',
  'Splunk ES': '#5FA81E',
  CrowdStrike: '#FF4B43',
  Proofpoint: '#FFB627',
  MISP: '#8C78FF',
}

export const srcColor = (src: string): string => SRC_COLORS[src] ?? '#7D6A55'

// Minutes → compact age: "14m" under an hour, "1.5h" beyond.
export const fmtAge = (m: number): string =>
  m < 60 ? `${m}m` : `${(m / 60).toFixed(1)}h`

export function fmtRelativeTime(
  iso: string | undefined,
  fallbackAgeMin: number,
) {
  const date = iso ? dayjs(iso) : dayjs().subtract(fallbackAgeMin, 'minute')
  return date.fromNow()
}
