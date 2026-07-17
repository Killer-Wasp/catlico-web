import { describe, expect, it } from 'vitest'
import type { Plugin, PluginRunner } from '#/components/Plugins/plugins.types'
import type { Token } from '#/components/Table/TokenSearch'
import { buildPluginFilterFields, filterPlugins } from '#/components/pages/plugins/pluginFilterSearch'

function plugin(over: Partial<Plugin> = {}): Plugin {
  return {
    id: 'obs-validator',
    displayName: 'Observable Validator',
    description: 'validates observables',
    manifest: { version: '1.0.0', triggers: ['observable.manual'] },
    available: true,
    runnerId: 'r1',
    runnerIds: ['r1'],
    enabled: true,
    autoRunEnabled: false,
    autoApplyActions: [],
    configParams: [],
    configComplete: true,
    ...over,
  }
}

const runners: PluginRunner[] = [
  { id: 'r1', name: 'runner-1' } as PluginRunner,
  { id: 'r2', name: 'runner-2' } as PluginRunner,
]

const tok = (field: string, value: string, op?: Token['op']): Token => ({
  field,
  value,
  label: value,
  op,
})

describe('filterPlugins', () => {
  const plugins = [
    plugin({ id: 'a', displayName: 'Alpha', enabled: true, runnerId: 'r1' }),
    plugin({ id: 'b', displayName: 'Beta', enabled: false, runnerId: 'r2' }),
    plugin({ id: 'c', displayName: 'Gamma', available: false, runnerId: null }),
  ]

  it('passes everything through with no tokens', () => {
    expect(filterPlugins(plugins, [], runners)).toHaveLength(3)
  })

  it('matches enum fields exactly', () => {
    const out = filterPlugins(plugins, [tok('enabled', 'disabled')], runners)
    expect(out.map((p) => p.id)).toEqual(['b'])
  })

  it('ORs values within a field', () => {
    const out = filterPlugins(
      plugins,
      [tok('runner', 'runner-1'), tok('runner', 'runner-2')],
      runners,
    )
    expect(out.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('ANDs across fields', () => {
    const out = filterPlugins(
      plugins,
      [tok('runner', 'runner-1'), tok('enabled', 'disabled')],
      runners,
    )
    expect(out).toHaveLength(0)
  })

  it('maps an unassigned runner to "None"', () => {
    const out = filterPlugins(plugins, [tok('runner', 'None')], runners)
    expect(out.map((p) => p.id)).toEqual(['c'])
  })

  it('does a substring name match by default (co)', () => {
    const out = filterPlugins(plugins, [tok('name', 'amm', 'co')], runners)
    expect(out.map((p) => p.id)).toEqual(['c'])
  })

  it('matches triggers from the manifest', () => {
    const out = filterPlugins(
      plugins,
      [tok('trigger', 'observable.manual')],
      runners,
    )
    expect(out).toHaveLength(3)
  })
})

describe('buildPluginFilterFields', () => {
  it('offers runner names plus None when some are unassigned', () => {
    const fields = buildPluginFilterFields(
      [plugin({ runnerId: 'r1' }), plugin({ id: 'x', runnerId: null })],
      runners,
    )
    const runner = fields.find((f) => f.key === 'runner')
    expect(runner?.options?.map((o) => o.value)).toEqual(['runner-1', 'None'])
  })
})
