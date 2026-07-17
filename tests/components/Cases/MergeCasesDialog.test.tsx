/**
 * @vitest-environment jsdom
 *
 * Component tests for MergeCasesDialog — the confirm dialog for case-to-case
 * merge. Covers pre-fill (max severity / most-restrictive TLP+PAP), the
 * client-side floor guard (can't pick a less-restrictive TLP/PAP than any
 * source), the submitted `{ sourceIds, case }` shape, and success navigation.
 *
 * Mocks the `mergeCases` fetcher and the router's `useNavigate`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  within,
} from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Case } from '#/components/Cases/cases.types'
import { MergeCasesDialog, canMergeCases } from '#/components/Cases/MergeCasesDialog'
import { mergeCases } from '#/components/Cases/casesQueries'
import type * as CasesQueries from '#/components/Cases/casesQueries'

const navigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('#/components/Cases/casesQueries', async (importOriginal) => {
  const actual = await importOriginal<typeof CasesQueries>()
  return { ...actual, mergeCases: vi.fn() }
})

vi.mock('@mantine/notifications', () => ({
  notifications: { show: vi.fn() },
}))

function caseFixture(overrides: Partial<Case> = {}): Case {
  return {
    id: '#1',
    sev: 2,
    tlp: 1,
    pap: 1,
    status: { id: 1, label: 'Open', stage: 'open', color: '#3b82f6' },
    title: 'A case',
    assignee: 'Unassigned',
    tags: [],
    tasksDone: 0,
    tasksTotal: 0,
    created: '1h',
    updated: '1h',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slaDueAt: null,
    slaState: null,
    ...overrides,
  }
}

function renderDialog(
  sources: Case[],
  props: Partial<{ onMerged: () => void }> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onClose = vi.fn()
  const tree = (nextSources: Case[]) => (
    <QueryClientProvider client={client}>
      <MantineProvider>
        <MergeCasesDialog
          opened
          sources={nextSources}
          onClose={onClose}
          onMerged={props.onMerged}
        />
      </MantineProvider>
    </QueryClientProvider>
  )
  const view = render(tree(sources))
  return {
    ...view,
    onClose,
    /** Re-render with a new sources array (new object identity). */
    setSources: (nextSources: Case[]) => view.rerender(tree(nextSources)),
  }
}

beforeEach(() => {
  vi.mocked(mergeCases).mockReset()
  navigate.mockReset()
})
afterEach(() => cleanup())

describe('canMergeCases', () => {
  it('requires at least two cases', () => {
    expect(canMergeCases(0)).toBe(false)
    expect(canMergeCases(1)).toBe(false)
    expect(canMergeCases(2)).toBe(true)
    expect(canMergeCases(5)).toBe(true)
  })
})

describe('MergeCasesDialog — pre-fill', () => {
  it('pre-fills max severity and most-restrictive (max) TLP/PAP from the sources', () => {
    renderDialog([
      caseFixture({ id: '#10', sev: 2, tlp: 1, pap: 0, title: 'Low one' }),
      caseFixture({ id: '#11', sev: 4, tlp: 2, pap: 3, title: 'High one' }),
    ])

    const sevGroup = screen.getByRole('radiogroup', { name: 'Severity' })
    expect(
      within(sevGroup).getByRole('radio', { name: 'CRITICAL' }),
    ).toHaveAttribute('aria-checked', 'true')

    const tlpGroup = screen.getByRole('radiogroup', { name: 'TLP' })
    expect(within(tlpGroup).getByRole('radio', { name: 'AMBER' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    const papGroup = screen.getByRole('radiogroup', { name: 'PAP' })
    expect(within(papGroup).getByRole('radio', { name: 'RED' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('pre-fills the title from the highest-severity source and warns about tombstoning', () => {
    renderDialog([
      caseFixture({ id: '#10', sev: 2, title: 'Low one' }),
      caseFixture({ id: '#11', sev: 4, title: 'High one' }),
    ])
    expect(screen.getByLabelText(/title/i)).toHaveValue('High one')
    // Prominent warning naming the count + the read-only/Duplicated outcome.
    const warning = screen.getByText(/read-only/i)
    expect(warning.textContent).toMatch(/2/)
    expect(warning.textContent).toMatch(/Duplicated/i)
  })
})

describe('MergeCasesDialog — TLP/PAP floor guard', () => {
  it('disables TLP/PAP values less restrictive than any source', () => {
    renderDialog([
      caseFixture({ id: '#10', tlp: 2, pap: 3 }),
      caseFixture({ id: '#11', tlp: 1, pap: 0 }),
    ])

    // TLP floor = AMBER(2): WHITE(0) + GREEN(1) disabled, AMBER/RED enabled.
    const tlpGroup = screen.getByRole('radiogroup', { name: 'TLP' })
    expect(within(tlpGroup).getByRole('radio', { name: 'WHITE' })).toBeDisabled()
    expect(within(tlpGroup).getByRole('radio', { name: 'GREEN' })).toBeDisabled()
    expect(
      within(tlpGroup).getByRole('radio', { name: 'AMBER' }),
    ).not.toBeDisabled()
    expect(within(tlpGroup).getByRole('radio', { name: 'RED' })).not.toBeDisabled()

    // PAP floor = RED(3): everything below RED disabled.
    const papGroup = screen.getByRole('radiogroup', { name: 'PAP' })
    expect(within(papGroup).getByRole('radio', { name: 'WHITE' })).toBeDisabled()
    expect(within(papGroup).getByRole('radio', { name: 'GREEN' })).toBeDisabled()
    expect(within(papGroup).getByRole('radio', { name: 'AMBER' })).toBeDisabled()
    expect(within(papGroup).getByRole('radio', { name: 'RED' })).not.toBeDisabled()
  })
})

describe('MergeCasesDialog — submit', () => {
  const survivor = {
    id: '#55',
    numericId: 55,
    case: caseFixture({ id: '#55' }),
  }

  it('submits { sourceIds, case } with the pre-filled max/most-restrictive values', async () => {
    vi.mocked(mergeCases).mockResolvedValue(survivor)

    renderDialog([
      caseFixture({ id: '#10', sev: 2, tlp: 1, pap: 0, title: 'Low' }),
      caseFixture({ id: '#11', sev: 4, tlp: 2, pap: 3, title: 'High' }),
    ])

    fireEvent.click(screen.getByRole('button', { name: /merge cases/i }))

    await waitFor(() => expect(mergeCases).toHaveBeenCalledTimes(1))
    const arg = vi.mocked(mergeCases).mock.calls[0][0]
    expect(arg.sourceIds).toEqual(['#10', '#11'])
    expect(arg.case).toMatchObject({
      title: 'High',
      severity: 4,
      tlp: 2,
      pap: 3,
    })
  })

  it('navigates to the new survivor case on success', async () => {
    vi.mocked(mergeCases).mockResolvedValue(survivor)
    const onMerged = vi.fn()

    renderDialog(
      [caseFixture({ id: '#10', sev: 4 }), caseFixture({ id: '#11', sev: 2 })],
      { onMerged },
    )

    fireEvent.click(screen.getByRole('button', { name: /merge cases/i }))

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: '/cases/$caseId/$tab',
        params: { caseId: '55', tab: 'details' },
      }),
    )
    expect(onMerged).toHaveBeenCalled()
  })

  it('leaves the dialog open (does not close or navigate) when the merge fails', async () => {
    vi.mocked(mergeCases).mockRejectedValue(
      new Error('Case #10 is already merged into #99'),
    )

    const { onClose } = renderDialog([
      caseFixture({ id: '#10', title: 'Keep me' }),
      caseFixture({ id: '#11' }),
    ])

    fireEvent.click(screen.getByRole('button', { name: /merge cases/i }))

    await waitFor(() => expect(mergeCases).toHaveBeenCalledTimes(1))
    // Failure must not tear down the dialog or lose the analyst's edits.
    expect(onClose).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/title/i)).toHaveValue('Keep me')
  })
})

describe('MergeCasesDialog — edits survive a background list refetch', () => {
  it('does not re-seed when sources array identity changes but the selection does not', () => {
    const initial = [
      caseFixture({ id: '#10', sev: 2, title: 'Seeded title' }),
      caseFixture({ id: '#11', sev: 4, title: 'High' }),
    ]
    const { setSources } = renderDialog(initial)

    // Analyst edits the pre-filled title.
    const titleInput = screen.getByLabelText(/title/i)
    fireEvent.change(titleInput, { target: { value: 'Analyst override' } })
    expect(titleInput).toHaveValue('Analyst override')

    // A background cases-list refetch hands CasesPage brand-new Case objects
    // (fresh identity) for the SAME selected ids — must NOT wipe the edit.
    setSources([
      caseFixture({ id: '#10', sev: 2, title: 'Seeded title' }),
      caseFixture({ id: '#11', sev: 4, title: 'High' }),
    ])

    expect(screen.getByLabelText(/title/i)).toHaveValue('Analyst override')
  })
})
