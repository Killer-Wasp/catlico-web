// @vitest-environment jsdom
import type { PatternDto, ProcedureDto } from '#/components/Attack/attackQueries'
import { TtpsPanel } from '#/components/pages/case-detail/TtpsPanel'
import { api } from '#/lib/api/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn() },
}))

function makePattern(
  external_id: string,
  name: string,
  tactic: string,
): PatternDto {
  return {
    id: `pat-${external_id}`,
    external_id,
    name,
    description: '',
    tactics: [tactic],
    url: '',
    parent_external_id: null,
    created_at: '2026-07-10T00:00:00Z',
  }
}

// A three-technique catalog for the picker matrix. Auto-imported patterns that
// are linked to a case but absent here exercise the linked-name fallback.
const catalog: PatternDto[] = [
  makePattern('T1566', 'Phishing', 'initial-access'),
  makePattern('T1059', 'Command and Scripting Interpreter', 'execution'),
  makePattern('T1078', 'Valid Accounts', 'initial-access'),
]

function makeProc(external_id: string, name: string): ProcedureDto {
  return {
    id: `proc-${external_id}`,
    case_id: 42,
    pattern_id: `pat-${external_id}`,
    pattern: {
      id: `pat-${external_id}`,
      external_id,
      name,
      description: '',
      tactics: [],
      url: '',
      parent_external_id: null,
      created_at: '2026-07-10T00:00:00Z',
    },
    description: '',
    created_at: '2026-07-10T00:00:00Z',
  }
}

// Server-side procedure set, mutated by the mocked PUT so a save->refetch cycle
// reflects the change (invalidateProcedureQueries refetches GET procedures).
let currentProcedures: ProcedureDto[] = []

const jsonResp = (data: unknown) =>
  ({ json: async () => data }) as unknown as ReturnType<typeof api.get>

type PutBody = { json: { procedures: { external_id: string; name?: string }[] } }

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <TtpsPanel caseId="#42" />
      </QueryClientProvider>
    </MantineProvider>,
  )
}

describe('TtpsPanel', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(((path: string) =>
      String(path).includes('procedures')
        ? jsonResp(currentProcedures)
        : jsonResp({ items: catalog })) as unknown as typeof api.get)

    vi.mocked(api.put).mockImplementation(((_path: string, opts: PutBody) => {
      // Simulate the server persisting the replacement set.
      currentProcedures = opts.json.procedures.map((p) =>
        makeProc(p.external_id, p.name ?? p.external_id),
      )
      return jsonResp(currentProcedures)
    }) as unknown as typeof api.put)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  test('unlink sends procedures that include name (guards the 422 regression)', async () => {
    currentProcedures = [
      makeProc('T1566', 'Phishing'),
      makeProc('T1059', 'Command and Scripting Interpreter'),
    ]
    renderPanel()

    await screen.findByText('Phishing')
    expect(screen.getByText('Command and Scripting Interpreter')).toBeTruthy()

    // Unlink T1566 (Phishing) — the remaining payload must still carry name.
    fireEvent.click(screen.getByLabelText('Remove T1566'))

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))

    const [path, options] = vi.mocked(api.put).mock.calls[0] as unknown as [
      string,
      PutBody,
    ]
    expect(path).toBe('cases/42/procedures')
    const sent = options.json.procedures
    expect(sent).toEqual([
      { external_id: 'T1059', name: 'Command and Scripting Interpreter' },
    ])
    for (const item of sent) expect(item.name).toBeTruthy()
  })

  test('picker save preserves names, incl. linked patterns absent from the catalog', async () => {
    // T9999 is linked but NOT in the catalog (auto-imported). Its name must be
    // preserved on save via the linked-name fallback, not degraded to the id.
    currentProcedures = [
      makeProc('T9999', 'Custom Auto-Imported Technique'),
      makeProc('T1059', 'Command and Scripting Interpreter'),
    ]
    renderPanel()
    await screen.findByText('Custom Auto-Imported Technique')

    fireEvent.click(screen.getByRole('button', { name: /add techniques/i }))

    // Add a catalog technique (T1078) to the existing selection.
    fireEvent.click(await screen.findByLabelText('T1078 Valid Accounts'))
    fireEvent.click(screen.getByRole('button', { name: /^save/i }))

    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1))
    const [, options] = vi.mocked(api.put).mock.calls[0] as unknown as [
      string,
      PutBody,
    ]
    expect(options.json.procedures).toEqual([
      { external_id: 'T9999', name: 'Custom Auto-Imported Technique' },
      { external_id: 'T1059', name: 'Command and Scripting Interpreter' },
      { external_id: 'T1078', name: 'Valid Accounts' },
    ])
    for (const item of options.json.procedures) expect(item.name).toBeTruthy()
  })

  test('reopening the picker after an unlink does not pre-select the removed technique', async () => {
    currentProcedures = [makeProc('T1059', 'Command and Scripting Interpreter')]
    renderPanel()
    await screen.findByText('Command and Scripting Interpreter')

    // 1. Open the picker and link T1566 via the matrix, then save (this leaves
    //    the dialog's local `selected` non-null — the stale-state trap).
    fireEvent.click(screen.getByRole('button', { name: /add techniques/i }))
    fireEvent.click(await screen.findByLabelText('T1566 Phishing'))
    fireEvent.click(screen.getByRole('button', { name: /^save/i }))

    // Picker closes; the linked list now shows both techniques.
    await waitFor(() =>
      expect(screen.queryByLabelText('T1566 Phishing')).toBeNull(),
    )
    await screen.findByLabelText('Remove T1566')

    // 2. Unlink T1566 from the row list.
    fireEvent.click(screen.getByLabelText('Remove T1566'))
    await waitFor(() =>
      expect(screen.queryByLabelText('Remove T1566')).toBeNull(),
    )

    // 3. Reopen the picker — T1566 must NOT be pre-selected (effective must be
    //    recomputed from the updated linked set, not the stale `selected`).
    fireEvent.click(screen.getByRole('button', { name: /add techniques/i }))
    const cell = await screen.findByLabelText('T1566 Phishing')
    expect(cell.getAttribute('data-selected')).not.toBe('true')
    // The still-linked technique should be selected.
    expect(
      screen
        .getByLabelText('T1059 Command and Scripting Interpreter')
        .getAttribute('data-selected'),
    ).toBe('true')
  })
})
