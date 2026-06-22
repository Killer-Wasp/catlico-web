import { queryOptions } from '@tanstack/react-query'
import { api } from '#/lib/api/client'
import type {
  Connector,
  ConnectorConfigItem,
  ConnectorConfigPayload,
  ConnectorKind,
  ConnectorManifest,
  ConnectorTab,
  TlpLevel,
} from './connectors.types'

export type ConnectorPublic = {
  name: string
  display_name: string
  connector_type: string
  version: string
  data_types: string[]
  description: string
  manifest?: ConnectorManifest
  available: boolean
  max_runtime_seconds: number
  enabled: boolean
  settings: Record<string, unknown>
  has_secrets: boolean
}

const COLORS = ['blue', 'orange', 'green', 'violet', 'yellow', 'red', 'gray']
const SECRET_NAME_PARTS = ['key', 'token', 'secret', 'password', 'credential']

export const connectorKeys = {
  all: ['connectors'] as const,
  catalog: () => [...connectorKeys.all, 'catalog'] as const,
}

export const initialConnectors: Connector[] = []

function initials(label: string): string {
  const parts = label.match(/[A-Za-z0-9]+/g) ?? []
  const text =
    parts.length >= 2
      ? parts
          .slice(0, 2)
          .map((part) => part.charAt(0))
          .join('')
      : label.replace(/[^A-Za-z0-9]/g, '').slice(0, 2)
  return (text || 'CN').toUpperCase()
}

function colorFor(id: string): string {
  const sum = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return COLORS[sum % COLORS.length] ?? 'gray'
}

function toKind(value: string): ConnectorKind {
  return value === 'responder' ? 'responder' : 'analyzer'
}

function toTlp(manifest: ConnectorManifest): TlpLevel {
  const maxTlp = manifest.config?.max_tlp
  if (typeof maxTlp !== 'number') return 'AMBER'
  if (maxTlp <= 1) return 'GREEN'
  if (maxTlp >= 3) return 'RED'
  return 'AMBER'
}

function versionLabel(version: string): string {
  if (!version) return 'v0.0.0'
  return version.startsWith('v') ? version : `v${version}`
}

function toConnector(dto: ConnectorPublic): Connector {
  const manifest = dto.manifest ?? {}
  const name = dto.display_name || dto.name
  return {
    id: dto.name,
    name,
    initials: initials(name),
    version: versionLabel(dto.version),
    kind: toKind(dto.connector_type),
    description: dto.description,
    observables: dto.data_types,
    tlp: toTlp(manifest),
    runs24h: 0,
    latency: `${dto.max_runtime_seconds}s max`,
    enabled: dto.enabled,
    color: colorFor(dto.name),
    available: dto.available,
    maxRuntimeSeconds: dto.max_runtime_seconds,
    settings: dto.settings,
    hasSecrets: dto.has_secrets,
    manifest,
    configItems: manifest.configurationItems ?? [],
  }
}

export function isSecretConfigItem(item: Pick<ConnectorConfigItem, 'name' | 'type'>) {
  const name = item.name.toLowerCase()
  return SECRET_NAME_PARTS.some((part) => name.includes(part))
}

function hasConfigValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function getMissingRequiredConfigItems({
  configItems,
  settings,
  hasSecrets,
}: Pick<Connector, 'configItems' | 'settings' | 'hasSecrets'>): string[] {
  return configItems
    .filter((item) => {
      if (!item.required) return false
      if (isSecretConfigItem(item) && hasSecrets) return false
      return !hasConfigValue(settings[item.name] ?? item.defaultValue)
    })
    .map((item) => item.name)
}

function coerceConfigValue(item: ConnectorConfigItem, value: unknown): unknown {
  if (item.type === 'integer' || item.type === 'number') {
    if (value === '' || value == null) return undefined
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : value
  }
  if (item.type === 'boolean') return Boolean(value)
  return value
}

export function buildConnectorConfigPayload(
  items: ConnectorConfigItem[],
  values: Record<string, unknown>,
): ConnectorConfigPayload {
  const settings: Record<string, unknown> = {}
  const secrets: Record<string, unknown> = {}

  for (const item of items) {
    const value = coerceConfigValue(item, values[item.name])
    if (value === undefined) continue
    if (isSecretConfigItem(item)) {
      if (typeof value === 'string' && value.trim() === '') continue
      secrets[item.name] = value
    } else {
      settings[item.name] = value
    }
  }

  return { settings, secrets }
}

export async function fetchConnectors(): Promise<Connector[]> {
  const connectors = await api.get('connectors').json<ConnectorPublic[]>()
  return connectors.map(toConnector)
}

export async function setConnectorEnabled(
  id: string,
  enabled: boolean,
): Promise<Connector> {
  const action = enabled ? 'enable' : 'disable'
  const connector = await api
    .post(`connectors/${id}/${action}`)
    .json<ConnectorPublic>()
  return toConnector(connector)
}

export async function saveConnectorConfig(
  id: string,
  payload: ConnectorConfigPayload,
): Promise<Connector> {
  const connector = await api
    .put(`connectors/${id}/config`, { json: payload })
    .json<ConnectorPublic>()
  return toConnector(connector)
}

export async function testConnectorConfig(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  return api
    .post(`connectors/${id}/config/test`)
    .json<{ ok: boolean; message: string }>()
}

export const connectorsQueryOptions = () =>
  queryOptions({
    queryKey: connectorKeys.catalog(),
    queryFn: fetchConnectors,
  })

export function filterConnectorsByTab(
  connectors: Connector[],
  tab: ConnectorTab,
) {
  if (tab === 'disabled') return connectors.filter((item) => !item.enabled)
  if (tab === 'analyzers')
    return connectors.filter((item) => item.kind === 'analyzer')
  if (tab === 'responders')
    return connectors.filter((item) => item.kind === 'responder')
  return connectors
}
