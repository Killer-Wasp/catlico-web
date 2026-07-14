/**
 * @vitest-environment jsdom
 *
 * Regression test: the backend dropped the `execute_responder_action` proposed-
 * action enum, so the web must no longer carry a friendly label for it. An action
 * of that (now-defunct) type falls back to rendering the raw type string instead
 * of "Execute responder action".
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProposedActionsStrip } from './ProposedActionsStrip'
import type { ProposedAction } from '#/components/Plugins/plugins.types'

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

const ACTION = {
  id: 'pa-1',
  pluginId: 'mailer',
  pluginRunId: 'run-1',
  actionType: 'execute_responder_action',
  entityType: 'case',
  entityId: '42',
  payload: {},
  status: 'proposed',
  decisionReason: null,
  decidedBy: null,
  decidedAt: null,
  createdAt: null,
} as unknown as ProposedAction

vi.mock('#/components/Plugins/proposedActions', () => ({
  proposedActionsQueryOptions: () => ({
    queryKey: ['proposed-actions', 'test'],
    queryFn: () => Promise.resolve([ACTION]),
  }),
  approveProposedAction: vi.fn(),
  rejectProposedAction: vi.fn(),
  proposedActionKeys: { all: ['proposed-actions'] },
}))

function renderStrip() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <ProposedActionsStrip entityType="case" entityId="42" />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => cleanup())

describe('ProposedActionsStrip — execute_responder_action label removed', () => {
  it('does not render the dropped "Execute responder action" label', async () => {
    renderStrip()
    await screen.findByText('Proposed Actions')

    expect(screen.queryByText('Execute responder action')).toBeNull()
    // The label branch is gone, so the raw type string shows through.
    expect(screen.getByText('execute_responder_action')).toBeTruthy()
  })
})
