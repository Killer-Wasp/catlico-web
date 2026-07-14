/**
 * @vitest-environment jsdom
 *
 * Component tests for PluginPickerDialog — the reusable analyzer chooser.
 * Covers: renders the runnable plugins, select-all toggles every row, the force
 * checkbox is present and threads into the callback, Run is disabled with no
 * selection, and Run hands back `{ pluginIds, force }`.
 *
 * Stubs at the `#/lib/api/client` boundary (the queryOptions closure calls the
 * real fetcher, so mocking the fetcher export wouldn't intercept it).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PluginPickerDialog } from './PluginPickerDialog'
import { api } from '#/lib/api/client'
import type { RunnablePlugin } from './plugins.types'

vi.mock('#/lib/api/client', () => ({
  api: { get: vi.fn() },
  API_BASE: '/api/v1',
}))

const getMock = vi.mocked(api.get)

const PLUGINS: RunnablePlugin[] = [
  { id: 'p1', name: 'VirusTotal', description: 'Reputation lookup', capabilities: ['enrichment'] },
  { id: 'p2', name: 'AbuseIPDB', description: 'IP abuse scoring', capabilities: ['enrichment'] },
  { id: 'p3', name: 'Shodan', description: 'Host intel', capabilities: ['enrichment'] },
]

function renderDialog(props: Partial<Parameters<typeof PluginPickerDialog>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onClose = vi.fn()
  const onRun = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <PluginPickerDialog opened onClose={onClose} onRun={onRun} {...props} />
      </MantineProvider>
    </QueryClientProvider>,
  )
  return { onClose, onRun }
}

beforeEach(() => {
  getMock.mockReset()
  getMock.mockReturnValue({
    json: () => Promise.resolve(PLUGINS),
  } as never)
})
afterEach(() => cleanup())

describe('PluginPickerDialog', () => {
  it('renders a checkbox row per runnable plugin', async () => {
    renderDialog()
    expect(await screen.findByText('VirusTotal')).toBeInTheDocument()
    expect(screen.getByText('AbuseIPDB')).toBeInTheDocument()
    expect(screen.getByText('Shodan')).toBeInTheDocument()
  })

  it('defaults the capability filter to "enrichment"', async () => {
    renderDialog()
    await screen.findByText('VirusTotal')
    expect(getMock).toHaveBeenCalledWith('plugins/runnable?capability=enrichment')
  })

  it('has a force re-run checkbox that is off by default', async () => {
    renderDialog()
    await screen.findByText('VirusTotal')
    const force = screen.getByRole('checkbox', { name: /force re-run/i })
    expect(force).not.toBeChecked()
  })

  it('disables Run until at least one plugin is selected', async () => {
    renderDialog()
    await screen.findByText('VirusTotal')
    const runButton = screen.getByRole('button', { name: 'Run' })
    expect(runButton).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: /virustotal/i }))
    expect(runButton).not.toBeDisabled()
  })

  it('select-all ticks every plugin, and passes them all to onRun', async () => {
    const { onRun } = renderDialog()
    await screen.findByText('VirusTotal')

    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1))
    const selection = onRun.mock.calls[0][0]
    expect(new Set(selection.pluginIds)).toEqual(new Set(['p1', 'p2', 'p3']))
    expect(selection.force).toBe(false)
  })

  it('passes the chosen plugin ids and force flag on Run', async () => {
    const { onRun } = renderDialog()
    await screen.findByText('VirusTotal')

    fireEvent.click(screen.getByRole('checkbox', { name: /abuseipdb/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /force re-run/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    await waitFor(() => expect(onRun).toHaveBeenCalledTimes(1))
    expect(onRun).toHaveBeenCalledWith({ pluginIds: ['p2'], force: true })
  })

  it('passes a custom capability to the fetcher', async () => {
    renderDialog({ capability: 'responder' })
    await screen.findByText('VirusTotal')
    expect(getMock).toHaveBeenCalledWith('plugins/runnable?capability=responder')
  })

  it('defaults its copy to "analyzer" (title "Run analyzers")', async () => {
    renderDialog()
    await screen.findByText('VirusTotal')
    expect(screen.getByText('Run analyzers')).toBeInTheDocument()
    expect(screen.queryByText('Run responders')).not.toBeInTheDocument()
  })

  it('derives its copy from the noun prop (title "Run responders", empty state "No runnable responders")', async () => {
    renderDialog({ noun: 'responder' })
    await screen.findByText('VirusTotal')
    expect(screen.getByText('Run responders')).toBeInTheDocument()
    expect(screen.queryByText('Run analyzers')).not.toBeInTheDocument()

    // And the empty state tracks the noun too.
    cleanup()
    getMock.mockReturnValue({ json: () => Promise.resolve([]) } as never)
    renderDialog({ noun: 'responder' })
    expect(await screen.findByText(/no runnable responders/i)).toBeInTheDocument()
  })

  it('resets the selection when closed and reopened', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = (opened: boolean) => (
      <QueryClientProvider client={client}>
        <MantineProvider>
          <PluginPickerDialog opened={opened} onClose={vi.fn()} onRun={vi.fn()} />
        </MantineProvider>
      </QueryClientProvider>
    )
    const { rerender } = render(tree(true))
    await screen.findByText('VirusTotal')

    fireEvent.click(screen.getByRole('checkbox', { name: /virustotal/i }))
    expect(screen.getByRole('button', { name: 'Run' })).not.toBeDisabled()

    // Close, then reopen — the prior selection must not persist.
    rerender(tree(false))
    rerender(tree(true))
    await screen.findByText('VirusTotal')
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  })

  it('shows an error state with a retry button when the fetch fails', async () => {
    getMock.mockReturnValue({
      json: () => Promise.reject(new Error('nope')),
    } as never)
    renderDialog()

    expect(
      await screen.findByText(/couldn.t load runnable analyzers/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  })

  it('shows an empty state when no plugins are runnable', async () => {
    getMock.mockReturnValue({ json: () => Promise.resolve([]) } as never)
    renderDialog()

    expect(await screen.findByText(/no runnable analyzers/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()
  })
})
