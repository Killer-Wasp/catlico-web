import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  analyzerRunTargets,
  dispatchAnalyzerRuns,
  summarizeRuns,
  notifyAnalyzerRuns,
} from './runAnalyzers'
import { queueObservablePluginRun } from '#/components/Observables/observablesQueries'
import { notifications } from '@mantine/notifications'

vi.mock('#/components/Observables/observablesQueries', () => ({
  queueObservablePluginRun: vi.fn(),
}))

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

const queue = vi.mocked(queueObservablePluginRun)

beforeEach(() => {
  queue.mockReset()
  vi.mocked(notifications.show).mockReset()
  queue.mockResolvedValue({ id: 'run-1' } as never)
})

describe('analyzerRunTargets', () => {
  it('builds the observables × plugins cross-product', () => {
    const targets = analyzerRunTargets(['o1', 'o2'], ['p1', 'p2', 'p3'])
    expect(targets).toHaveLength(6)
    expect(targets).toContainEqual({ observableId: 'o1', pluginId: 'p2' })
    expect(targets).toContainEqual({ observableId: 'o2', pluginId: 'p3' })
  })
})

describe('dispatchAnalyzerRuns', () => {
  it('dispatches one call per plugin for a single observable, with the observable id and force', async () => {
    const targets = analyzerRunTargets(['obs-9'], ['a', 'b'])
    await dispatchAnalyzerRuns(targets, true)

    expect(queue).toHaveBeenCalledTimes(2)
    expect(queue).toHaveBeenCalledWith('obs-9', { plugin_id: 'a', force: true })
    expect(queue).toHaveBeenCalledWith('obs-9', { plugin_id: 'b', force: true })
  })

  it('fans out plugins × observables and drops none under the concurrency cap', async () => {
    const observableIds = Array.from({ length: 12 }, (_, i) => `o${i}`)
    const pluginIds = ['p1', 'p2', 'p3']
    const targets = analyzerRunTargets(observableIds, pluginIds)

    const results = await dispatchAnalyzerRuns(targets, false)

    // 12 observables × 3 plugins = 36 dispatches, none dropped.
    expect(queue).toHaveBeenCalledTimes(36)
    expect(results).toHaveLength(36)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('passes force=false through to every dispatch by default', async () => {
    await dispatchAnalyzerRuns(analyzerRunTargets(['o1'], ['p1']), false)
    expect(queue).toHaveBeenCalledWith('o1', { plugin_id: 'p1', force: false })
  })

  it('surfaces a rejected dispatch as a rejected settlement (partial failure)', async () => {
    queue.mockImplementation(async (_observableId, body) => {
      if (body.plugin_id === 'bad') throw new Error('runner offline')
      return { id: 'run-ok' } as never
    })

    const targets = analyzerRunTargets(['o1'], ['good', 'bad'])
    const results = await dispatchAnalyzerRuns(targets, false)

    expect(summarizeRuns(results)).toEqual({ total: 2, queued: 1, failed: 1 })
  })
})

describe('summarizeRuns', () => {
  it('counts fulfilled vs rejected', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: new Error('x') },
      { status: 'fulfilled', value: 2 },
    ]
    expect(summarizeRuns(results)).toEqual({ total: 3, queued: 2, failed: 1 })
  })
})

describe('notifyAnalyzerRuns', () => {
  it('toasts a success summary when nothing failed', () => {
    notifyAnalyzerRuns([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ])
    const arg = vi.mocked(notifications.show).mock.calls[0][0]
    expect(arg.title).toBe('Queued 2 runs')
    expect(arg.color).toBe('green')
  })

  it('toasts a yellow partial summary when some queued and some failed', () => {
    notifyAnalyzerRuns([
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: new Error('boom') },
    ])
    const arg = vi.mocked(notifications.show).mock.calls[0][0]
    expect(arg.title).toBe('Queued 1 run, 1 failed')
    expect(arg.color).toBe('yellow')
  })

  it('toasts a RED all-failed summary when every dispatch rejected (never yellow)', () => {
    notifyAnalyzerRuns([
      { status: 'rejected', reason: new Error('a') },
      { status: 'rejected', reason: new Error('b') },
    ])
    const arg = vi.mocked(notifications.show).mock.calls[0][0]
    expect(arg.title).toBe('All 2 runs failed')
    expect(arg.color).toBe('red')
  })
})
