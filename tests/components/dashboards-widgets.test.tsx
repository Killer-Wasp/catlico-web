/**
 * Widget-catalog invariants for the customisable Dashboards page. These guard
 * the contract between saved layouts (widget `type` strings persisted in the
 * backend `dashboard.layout`) and the renderer: every catalog entry must
 * render, and the default template must only reference real catalog types.
 */
import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Overview } from '#/components/Overview/overviewQueries'
import {
  DEFAULT_LAYOUT,
  WIDGET_CATALOG,
  renderWidget,
} from '#/components/Dashboards/widgets'

const overview: Overview = {
  generatedAt: '2026-07-11T00:00:00Z',
  stats: {
    openCases: 5,
    openCasesDelta: 1,
    newAlerts24h: 16,
    newAlertsDeltaPct: 314.8,
    slaBreaches: 5,
    slaBreachesCritical: 2,
    slaBreachesHigh: 3,
    mttrHours7d: 24,
    mttrDeltaHours: -24,
  },
  alertsBySeverity: [
    { label: 'critical', count: 1 },
    { label: 'high', count: 7 },
    { label: 'medium', count: 9 },
    { label: 'low', count: 5 },
  ],
  openAlertsTotal: 22,
  triageQueue: [],
  casePipeline: [
    { label: 'New', count: 2 },
    { label: 'In progress', count: 3 },
    { label: 'Resolved', count: 6 },
    { label: 'Duplicated', count: 0 },
  ],
  analystWorkload: [{ name: 'Alex Analyst', email: null, openTasks: 14 }],
  ingestion24h: [{ hour: '2026-07-11T00:00:00Z', ingested: 2, promoted: 1 }],
  latestObservables: [
    {
      id: 'obs-1',
      type: 'ip',
      value: '203.0.113.47',
      ioc: true,
      date: '2026-07-11T00:00:00Z',
    },
  ],
  trendDays: 14,
  caseTrend: [{ date: '2026-07-11T00:00:00Z', opened: 1, resolved: 0 }],
  resolutionBreakdown: [{ label: 'True positive', count: 3 }],
  alertsBySource: [{ label: 'Splunk ES', count: 8 }],
  iocsTracked: 13,
  casesBySeverity: [
    { label: 'critical', count: 3 },
    { label: 'high', count: 5 },
    { label: 'medium', count: 3 },
    { label: 'low', count: 0 },
  ],
  slaCompliance: { met: 2, breached: 7, pct: 22.2 },
}

const renderInProvider = (node: React.ReactNode) =>
  render(<MantineProvider>{node}</MantineProvider>)

describe('widget catalog', () => {
  it('renders every catalog widget without crashing', () => {
    for (const type of Object.keys(WIDGET_CATALOG)) {
      const { container, unmount } = renderInProvider(
        renderWidget(type, overview),
      )
      expect(container.textContent, type).not.toContain('Unknown widget')
      expect(container.firstChild, type).not.toBeNull()
      unmount()
    }
  })

  it('falls back to a labelled placeholder for unknown types', () => {
    const { container } = renderInProvider(
      renderWidget('chart.does_not_exist', overview),
    )
    expect(container.textContent).toContain('Unknown widget')
  })

  it('default layout only references real catalog widgets', () => {
    for (const w of DEFAULT_LAYOUT) {
      expect(WIDGET_CATALOG[w.type], w.type).toBeDefined()
    }
  })

  it('trend widgets title themselves from the selected window', () => {
    const { container } = renderInProvider(
      renderWidget('chart.case_trend', { ...overview, trendDays: 30 }),
    )
    expect(container.textContent).toContain('Case trend · 30 days')
  })
})
