/**
 * Analyzer-run fan-out: turn a picker selection (plugin ids + force) plus one or
 * more target observables into bounded-concurrency `POST /observables/{id}/
 * plugin-runs` dispatches, then summarise the outcome as a toast linking to the
 * runs list. Shared by the observable detail drawer (single observable) and the
 * observables page bulk action (many observables). Keeping the fan-out here — not
 * in either caller — keeps the picker itself a dumb, reusable chooser.
 */
import { Link } from '@tanstack/react-router'
import { Anchor } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { allSettledPooled } from '#/lib/pool'
import { queueObservablePluginRun } from '#/components/Observables/observablesQueries'
import type { PluginRunPublic } from './plugins.types'

/** One (observable, plugin) dispatch. */
export type AnalyzerRunTarget = { observableId: string; pluginId: string }

/** Cross-product of observables × plugins, in a stable order (observable-major). */
export function analyzerRunTargets(
  observableIds: readonly string[],
  pluginIds: readonly string[],
): AnalyzerRunTarget[] {
  return observableIds.flatMap((observableId) =>
    pluginIds.map((pluginId) => ({ observableId, pluginId })),
  )
}

/** Cap on simultaneous in-flight dispatches — don't flood the API. */
export const ANALYZER_RUN_CONCURRENCY = 5

/**
 * Dispatch every target, at most `ANALYZER_RUN_CONCURRENCY` at a time. Always
 * resolves; a failed dispatch surfaces as a rejected result, not a thrown error.
 */
export function dispatchAnalyzerRuns(
  targets: readonly AnalyzerRunTarget[],
  force: boolean,
): Promise<PromiseSettledResult<PluginRunPublic>[]> {
  return allSettledPooled(
    targets,
    (target) =>
      queueObservablePluginRun(target.observableId, {
        plugin_id: target.pluginId,
        force,
      }),
    ANALYZER_RUN_CONCURRENCY,
  )
}

export type RunSummary = { total: number; queued: number; failed: number }

/** Pure tally of settled dispatch results. */
export function summarizeRuns(
  results: readonly PromiseSettledResult<unknown>[],
): RunSummary {
  const failed = results.filter((r) => r.status === 'rejected').length
  return { total: results.length, queued: results.length - failed, failed }
}

const plural = (n: number) => (n === 1 ? '' : 's')

/**
 * Toast the outcome of a fan-out, with a link to the runs list for status.
 * Three distinct outcomes so a total failure never masquerades as partial
 * success: all-failed is red, genuine partial (some queued, some failed) is
 * yellow, all-success is green.
 */
export function notifyAnalyzerRuns(
  results: readonly PromiseSettledResult<unknown>[],
): void {
  const { queued, failed } = summarizeRuns(results)
  const color = queued === 0 ? 'red' : failed > 0 ? 'yellow' : 'green'
  const title =
    queued === 0
      ? `All ${failed} run${plural(failed)} failed`
      : failed > 0
        ? `Queued ${queued} run${plural(queued)}, ${failed} failed`
        : `Queued ${queued} run${plural(queued)}`
  notifications.show({
    color,
    title,
    message: (
      <Anchor component={Link} to="/plugin-runs">
        View plugin runs
      </Anchor>
    ),
  })
}
