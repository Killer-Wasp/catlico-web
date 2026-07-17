/**
 * runnerFilterSearch.ts — client-side token filtering for the plugin runners
 * table. The runner list is tiny and fully loaded, so filtering runs in the
 * browser via the shared token model. See `clientTokenFilter` for the
 * OR-within / AND-across grouping semantics.
 */

import type { PluginRunner } from '#/components/Plugins/plugins.types'
import { filterByTokens, matchText } from '#/components/Table/clientTokenFilter'
import type { Token, TokenField } from '#/components/Table/TokenSearch'

const toOpts = (xs: string[]) =>
  [...xs].sort().map((x) => ({ value: x, label: x }))

/** Derive the filterable fields from the loaded runners. */
export function buildRunnerFilterFields(runners: PluginRunner[]): TokenField[] {
  const statuses = new Set<string>()
  const isolation = new Set<string>()
  const versions = new Set<string>()
  for (const r of runners) {
    statuses.add(r.status)
    if (r.isolationMode) isolation.add(r.isolationMode)
    if (r.version) versions.add(r.version)
  }

  return [
    { key: 'name', label: 'Name', kind: 'text', operators: ['co', 'eq'] },
    {
      key: 'status',
      label: 'Status',
      kind: 'enum',
      operators: ['eq'],
      options: toOpts([...statuses]),
    },
    {
      key: 'isolation',
      label: 'Isolation',
      kind: 'enum',
      operators: ['eq'],
      options: toOpts([...isolation]),
    },
    ...(versions.size
      ? [
          {
            key: 'version',
            label: 'Version',
            kind: 'enum' as const,
            operators: ['eq' as const],
            options: toOpts([...versions]),
          },
        ]
      : []),
  ]
}

function matchToken(runner: PluginRunner, token: Token): boolean {
  switch (token.field) {
    case 'name':
      return matchText(token, runner.name, runner.id)
    case 'status':
      return runner.status === token.value
    case 'isolation':
      return runner.isolationMode === token.value
    case 'version':
      return runner.version === token.value
    default:
      return true
  }
}

/** Filter the runners by the active tokens (OR within a field, AND across). */
export function filterRunners(
  runners: PluginRunner[],
  tokens: Token[],
): PluginRunner[] {
  return filterByTokens(runners, tokens, matchToken)
}
