// @vitest-environment jsdom
import type { CaseDetailAttachment } from '#/components/Cases/caseDetails.types'
import { AttachmentsPanel } from '#/components/pages/case-detail/AttachmentsPanel'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

const attachment: CaseDetailAttachment = {
  id: 'attachment-1',
  linkId: 1,
  kind: 'HEIC',
  name: 'IMG_1781.HEIC',
  size: '2.7 MB',
  sizeBytes: 2_700_000,
  sha256: '0fce3c9a02f2e360854c32006080b644861aed65437fd08c94507d6d85515ae9',
  contentType: 'image/heic',
  author: 'analyst@example.com',
  time: '6ec09851-f341-4a26-88b2',
}

// Hoisted so the mock factory (evaluated before top-level consts) can seed the
// attachments query with the same fixture the assertions use.
const { attachmentFixture } = vi.hoisted(() => ({
  attachmentFixture: {
    id: 'attachment-1',
    linkId: 1,
    kind: 'HEIC',
    name: 'IMG_1781.HEIC',
    size: '2.7 MB',
    sizeBytes: 2_700_000,
    sha256: '0fce3c9a02f2e360854c32006080b644861aed65437fd08c94507d6d85515ae9',
    contentType: 'image/heic',
    author: 'analyst@example.com',
    time: '6ec09851-f341-4a26-88b2',
  },
}))

vi.mock('#/components/Cases/casesQueries', () => ({
  // `initialData` makes the panel's useQuery resolve synchronously in tests.
  caseAttachmentsQueryOptions: (caseId: string) => ({
    queryKey: ['case', caseId, 'attachments'],
    queryFn: async () => [attachmentFixture],
    initialData: [attachmentFixture],
  }),
  invalidateAttachmentQueries: vi.fn(),
  deleteCaseAttachment: vi.fn(),
  downloadCaseAttachment: vi.fn(),
  uploadCaseAttachment: vi.fn(),
}))

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

afterEach(() => {
  cleanup()
})

function Harness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <AttachmentsPanel caseId="3" />
      </MantineProvider>
    </QueryClientProvider>
  )
}

describe('AttachmentsPanel', () => {
  test('keeps long attachment metadata inside the file column', () => {
    render(<Harness />)

    const table = screen.getByRole('table', { name: /case attachments/i })
    const headers = within(table).getAllByRole('columnheader')

    expect(headers).toHaveLength(2)
    expect(headers[0]?.textContent).toBe('File')
    // Actions column is icon-only with a blank header, like the cases list.
    expect(headers[1]?.textContent).toBe('')

    const row = screen.getByRole('row', { name: /IMG_1781\.HEIC/i })
    expect(row.textContent).toContain('2.7 MB')
    expect(row.textContent).toContain('6ec09851-f341-4a26-88b2')
  })

  test('shows attachment actions in a dropdown menu', async () => {
    render(<Harness />)

    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Show info' })).toBeNull()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Attachment actions for IMG_1781.HEIC',
      }),
    )

    expect(await screen.findByText('Download')).toBeTruthy()
    expect(screen.getByText('Show info')).toBeTruthy()
    expect(screen.getByText('Remove')).toBeTruthy()
  })

  test('moves SHA and uploader details from the row into an info dialog', async () => {
    render(<Harness />)

    const row = screen.getByRole('row', { name: /IMG_1781\.HEIC/i })

    expect(row.textContent).toContain('2.7 MB')
    expect(row.textContent).toContain('6ec09851-f341-4a26-88b2')
    expect(row.textContent).not.toContain('sha256')
    expect(row.textContent).not.toContain(attachment.sha256)
    expect(row.textContent).not.toContain('analyst@example.com')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Attachment actions for IMG_1781.HEIC',
      }),
    )
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Show info' }))

    expect(
      await screen.findByRole('dialog', { name: /IMG_1781\.HEIC info/i }),
    ).toBeTruthy()
    expect(screen.getByText('Size')).toBeTruthy()
    expect(screen.getByText('2.7 MB')).toBeTruthy()
    expect(screen.getByText('SHA-256')).toBeTruthy()
    expect(screen.getByText(attachment.sha256)).toBeTruthy()
    expect(screen.getByText('Uploaded date')).toBeTruthy()
    expect(screen.getByText('6ec09851-f341-4a26-88b2')).toBeTruthy()
    expect(screen.getByText('Uploaded by')).toBeTruthy()
    expect(screen.getByText('analyst@example.com')).toBeTruthy()
  })
})
