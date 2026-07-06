// @vitest-environment jsdom
import type { CaseDetailAttachment } from '#/components/Cases/caseDetails.types'
import { AttachmentsPanel } from '#/components/pages/case-detail/AttachmentsPanel'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'

vi.mock('#/components/Cases/casesQueries', () => ({
  caseKeys: {
    fullDetail: (caseId: string) => ['case', caseId],
  },
  deleteCaseAttachment: vi.fn(),
  downloadCaseAttachment: vi.fn(),
  uploadCaseAttachment: vi.fn(),
}))

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
        <AttachmentsPanel attachments={[attachment]} caseId="3" />
      </MantineProvider>
    </QueryClientProvider>
  )
}

describe('AttachmentsPanel', () => {
  test('shows attachment actions in a dropdown menu', async () => {
    render(<Harness />)

    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Attachment actions for IMG_1781.HEIC',
      }),
    )

    expect(await screen.findByText('Download')).toBeTruthy()
    expect(screen.getByText('Remove')).toBeTruthy()
  })
})
