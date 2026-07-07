// @vitest-environment jsdom
import { DataTable } from '#/components/Table/DataTable'
import { MantineProvider } from '@mantine/core'
import type { ColumnDef } from '@tanstack/react-table'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test } from 'vitest'

type Person = {
  name: string
  status: string
}

const DATA: Person[] = [{ name: 'Ada Lovelace', status: 'Active' }]

const COLUMNS: ColumnDef<Person>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (info) => info.getValue(),
    meta: { grow: true },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (info) => info.getValue(),
    meta: { compact: true, nowrap: true },
  },
]

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
  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
})

function Harness({ isFetching = false }: { isFetching?: boolean } = {}) {
  const table = useReactTable({
    data: DATA,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <MantineProvider>
      <DataTable
        table={table}
        minWidth={260}
        emptyMessage="No people"
        ariaLabel="People"
        isFetching={isFetching}
      />
    </MantineProvider>
  )
}

afterEach(cleanup)

describe('DataTable', () => {
  test('renders content-aware columns without resize handles', () => {
    render(<Harness />)

    const nameHeader = screen.getByRole('columnheader', { name: /Name/ })
    const statusHeader = screen.getByRole('columnheader', { name: /Status/ })

    expect(nameHeader.style.width).toBe('auto')
    expect(statusHeader.style.width).toBe('max-content')
    expect(statusHeader.style.paddingInline).toBe('0.5rem')
    expect(screen.queryByRole('button', { name: /Resize/ })).toBeNull()
  })

  test('keeps rendered rows at full opacity during background fetches', () => {
    render(<Harness isFetching />)

    screen.getByRole('table', { name: 'People' })
    expect(document.querySelector('[style*="opacity: 0.55"]')).toBeNull()
    expect(screen.getByText('Ada Lovelace')).toBeDefined()
  })
})
