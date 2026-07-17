/**
 * runFilterSearch.ts — client-side token filtering for the plugin runs table.
 *
 * The runs view loads a bounded window (limit 200) in one shot, so filtering
 * runs in the browser via the shared token model. See `clientTokenFilter` for
 * the OR-within / AND-across grouping semantics.
 */

import type { PluginRun } from '#/components/Plugins/plugins.types'
import { filterByTokens, matchText } from '#/components/Table/clientTokenFilter'
import type { Token, TokenField } from '#/components/Table/TokenSearch'

const toOpts = (xs: string[]) =>
  [...xs].sort().map((x) => ({ value: x, label: x }))

/** Derive the filterable fields from the loaded runs window. */
export function buildRunFilterFields(runs: PluginRun[]): TokenField[] {
  const plugins = new Set<string>()
  const events = new Set<string>()
  const statuses = new Set<string>()
  const skips = new Set<string>()
  for (const r of runs) {
    plugins.add(r.pluginId)
    events.add(r.eventType)
    statuses.add(r.status)
    if (r.skipReason) skips.add(r.skipReason)
  }

  return [
    { key: 'run', label: 'Run', kind: 'text', operators: ['co', 'eq'] },
    {
      key: 'plugin',
      label: 'Plugin',
      kind: 'enum',
      operators: ['eq'],
      options: toOpts([...plugins]),
    },
    {
      key: 'event',
      label: 'Event',
      kind: 'enum',
      operators: ['eq'],
      options: toOpts([...events]),
    },
    {
      key: 'status',
      label: 'Status',
      kind: 'enum',
      operators: ['eq'],
      options: toOpts([...statuses]),
    },
    ...(skips.size
      ? [
          {
            key: 'skip',
            label: 'Skip',
            kind: 'enum' as const,
            operators: ['eq' as const],
            options: toOpts([...skips]),
          },
        ]
      : []),
  ]
}

function matchToken(run: PluginRun, token: Token): boolean {
  switch (token.field) {
    case 'run':
      return matchText(token, run.id)
    case 'plugin':
      return run.pluginId === token.value
    case 'event':
      return run.eventType === token.value
    case 'status':
      return run.status === token.value
    case 'skip':
      return run.skipReason === token.value
    default:
      return true
  }
}

/** Filter the runs by the active tokens (OR within a field, AND across). */
export function filterRuns(runs: PluginRun[], tokens: Token[]): PluginRun[] {
  return filterByTokens(runs, tokens, matchToken)
}
