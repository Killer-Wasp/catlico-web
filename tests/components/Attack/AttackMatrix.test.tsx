// @vitest-environment jsdom
import { AttackMatrix } from '#/components/Attack/AttackMatrix'
import type { MatrixColumn } from '#/components/Attack/buildMatrix'
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

afterEach(cleanup)

const COLUMNS: MatrixColumn[] = [
  {
    tactic: 'initial-access',
    label: 'Initial Access',
    techniques: [
      {
        externalId: 'T1566',
        name: 'Phishing',
        url: '',
        description: '',
        caseCount: 3,
        subtechniques: [],
      },
    ],
  },
  {
    tactic: 'execution',
    label: 'Execution',
    techniques: [
      {
        externalId: 'T1059',
        name: 'Command and Scripting Interpreter',
        url: '',
        description: '',
        caseCount: 0,
        subtechniques: [],
      },
    ],
  },
]

const SUB_COLUMNS: MatrixColumn[] = [
  {
    tactic: 'initial-access',
    label: 'Initial Access',
    techniques: [
      {
        externalId: 'T1566',
        name: 'Phishing',
        url: '',
        description: '',
        caseCount: 3,
        subtechniques: [
          {
            externalId: 'T1566.001',
            name: 'Spearphishing Attachment',
            url: '',
            description: '',
            caseCount: 1,
            subtechniques: [],
          },
        ],
      },
    ],
  },
  {
    tactic: 'execution',
    label: 'Execution',
    techniques: [
      {
        externalId: 'T1059',
        name: 'Command and Scripting Interpreter',
        url: '',
        description: '',
        caseCount: 0,
        subtechniques: [],
      },
    ],
  },
]

function renderMatrix(props: Partial<Parameters<typeof AttackMatrix>[0]> = {}) {
  return render(
    <MantineProvider>
      <AttackMatrix columns={COLUMNS} mode="heatmap" {...props} />
    </MantineProvider>,
  )
}

function renderSubMatrix(
  props: Partial<Parameters<typeof AttackMatrix>[0]> = {},
) {
  return render(
    <MantineProvider>
      <AttackMatrix columns={SUB_COLUMNS} mode="heatmap" {...props} />
    </MantineProvider>,
  )
}

describe('AttackMatrix', () => {
  test('renders tactic columns and technique cells', () => {
    renderMatrix()
    expect(screen.getByText('Initial Access')).toBeDefined()
    expect(screen.getByText('Execution')).toBeDefined()
    expect(screen.getByText('Phishing')).toBeDefined()
  })

  test('heatmap mode: clicking a cell reports the technique', () => {
    const onOpenTechnique = vi.fn()
    renderMatrix({ onOpenTechnique })
    fireEvent.click(screen.getByRole('button', { name: /Phishing/ }))
    expect(onOpenTechnique).toHaveBeenCalledWith('T1566')
  })

  test('picker mode: clicking toggles selection', () => {
    const onToggle = vi.fn()
    renderMatrix({
      mode: 'picker',
      selectedIds: new Set(['T1059']),
      onToggle,
    })
    fireEvent.click(screen.getByRole('button', { name: /Phishing/ }))
    expect(onToggle).toHaveBeenCalledWith('T1566')
    expect(
      screen
        .getByRole('button', { name: /Command and Scripting/ })
        .getAttribute('data-selected'),
    ).toBe('true')
  })

  test('search filters cells to matching techniques', () => {
    renderMatrix({ mode: 'picker', search: 'phish' })
    expect(screen.getByText('Phishing')).toBeDefined()
    expect(screen.queryByText('Command and Scripting Interpreter')).toBeNull()
  })

  test('renders subtechnique cells under their parent', () => {
    renderSubMatrix()
    expect(screen.getByText('Spearphishing Attachment')).toBeDefined()
    expect(
      screen.getByRole('button', { name: /Spearphishing Attachment/ }),
    ).toBeDefined()
  })

  test('picker mode: clicking a subtechnique toggles the SUB id', () => {
    const onToggle = vi.fn()
    renderSubMatrix({ mode: 'picker', onToggle })
    fireEvent.click(
      screen.getByRole('button', { name: /Spearphishing Attachment/ }),
    )
    expect(onToggle).toHaveBeenCalledWith('T1566.001')
    expect(onToggle).not.toHaveBeenCalledWith('T1566')
  })

  test('search matching only a subtechnique keeps the parent column visible', () => {
    renderSubMatrix({ mode: 'picker', search: 'spearphishing' })
    // Parent column stays visible and the matching sub is shown...
    expect(screen.getByText('Phishing')).toBeDefined()
    expect(screen.getByText('Spearphishing Attachment')).toBeDefined()
    // ...while the non-matching sibling technique/column is hidden.
    expect(screen.queryByText('Command and Scripting Interpreter')).toBeNull()
  })
})
