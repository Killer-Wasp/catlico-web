/**
 * pluginFilterSearch.ts — client-side token filtering for the plugins catalog.
 *
 * The catalog is small (well under 100 rows) and already loads in full, so —
 * unlike the server-side cases/alerts clause API — filtering runs in the
 * browser. This mirrors the cases page's token model (build `TokenField`s from
 * the data, match a `Token[]` against each row) so the shared filter bar /
 * TablePanel can be reused verbatim, but keeps the matching local. Grouping
 * (OR within a field, AND across fields) is handled by `filterByTokens`.
 */

import type { Plugin, PluginRunner } from '#/components/Plugins/plugins.types'
import { filterByTokens, matchText } from '#/components/Table/clientTokenFilter'
import type { Token, TokenField } from '#/components/Table/TokenSearch'

const NONE = 'None'

/** The runner display name a plugin is bound to, or "None" when unassigned. */
function pluginRunnerName(plugin: Plugin, runners: PluginRunner[]): string {
  const r = runners.find((rn) => rn.id === plugin.runnerId)
  return r?.name ?? NONE
}

/** The trigger identifiers a plugin exposes (event types like "observable.created"). */
function pluginTriggers(plugin: Plugin): string[] {
  return plugin.manifest.triggers ?? []
}

const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }))

/**
 * Derive the filterable fields from the current catalog. Options come from the
 * data itself so every present runner/trigger stays selectable.
 */
export function buildPluginFilterFields(
  plugins: Plugin[],
  runners: PluginRunner[],
): TokenField[] {
  const runnerNames = new Set<string>()
  let anyUnassigned = false
  const triggers = new Set<string>()
  for (const p of plugins) {
    if (p.runnerId) runnerNames.add(pluginRunnerName(p, runners))
    else anyUnassigned = true
    for (const trig of pluginTriggers(p)) triggers.add(trig)
  }
  const runnerOptions = [...runnerNames].sort()
  if (anyUnassigned) runnerOptions.push(NONE)

  return [
    { key: 'name', label: 'Name', kind: 'text', operators: ['co', 'eq'] },
    {
      key: 'status',
      label: 'Status',
      kind: 'enum',
      operators: ['eq'],
      options: [
        { value: 'available', label: 'Available' },
        { value: 'unavailable', label: 'Not installed' },
      ],
    },
    {
      key: 'enabled',
      label: 'Enabled',
      kind: 'enum',
      operators: ['eq'],
      options: [
        { value: 'enabled', label: 'Enabled' },
        { value: 'disabled', label: 'Disabled' },
      ],
    },
    {
      key: 'runner',
      label: 'Runner',
      kind: 'enum',
      operators: ['eq'],
      options: toOpts(runnerOptions),
    },
    {
      key: 'trigger',
      label: 'Trigger',
      kind: 'enum',
      operators: ['eq'],
      options: toOpts([...triggers].sort()),
    },
  ]
}

/** Does a single plugin satisfy one token? */
function matchToken(
  plugin: Plugin,
  token: Token,
  runners: PluginRunner[],
): boolean {
  switch (token.field) {
    case 'name':
      return matchText(token, plugin.displayName, plugin.id, plugin.description)
    case 'status':
      return (plugin.available ? 'available' : 'unavailable') === token.value
    case 'enabled':
      return (plugin.enabled ? 'enabled' : 'disabled') === token.value
    case 'runner':
      return pluginRunnerName(plugin, runners) === token.value
    case 'trigger':
      return pluginTriggers(plugin).includes(token.value)
    default:
      return true
  }
}

/** Filter the catalog by the active tokens (OR within a field, AND across). */
export function filterPlugins(
  plugins: Plugin[],
  tokens: Token[],
  runners: PluginRunner[],
): Plugin[] {
  return filterByTokens(plugins, tokens, (p, t) => matchToken(p, t, runners))
}
