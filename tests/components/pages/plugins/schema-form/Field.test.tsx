import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { MantineProvider } from '@mantine/core'
import { SchemaField } from '#/components/pages/plugins/schema-form/Field'
import type { PluginConfigParam } from '#/components/Plugins/plugins.types'

describe('CronPreview', () => {
  afterEach(() => cleanup())

  const createCronParam = (overrides?: Partial<PluginConfigParam>): PluginConfigParam => ({
    name: 'schedule',
    description: 'Cron schedule',
    type: 'cron',
    required: false,
    ...overrides,
  })

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <MantineProvider>
        {component}
      </MantineProvider>,
    )
  }

  it('renders fire times for a valid cron expression', () => {
    const param = createCronParam()
    const { container } = renderWithProvider(
      <SchemaField
        param={param}
        value="0 12 * * *"
        onChange={() => {}}
      />,
    )

    // Should render the preview text
    const previewText = screen.queryByText(/Next.*fire time/i)
    expect(previewText).not.toBeNull()

    // Should show timestamps in monospace
    const timestamps = container.querySelectorAll('[style*="monospace"]')
    expect(timestamps.length).toBeGreaterThan(0)
  })

  it('renders nothing for an invalid cron expression', () => {
    const param = createCronParam()
    const { container } = renderWithProvider(
      <SchemaField
        param={param}
        value="invalid cron expression"
        onChange={() => {}}
      />,
    )

    // Should not render the preview
    const previewText = screen.queryByText(/Next.*fire time/i)
    expect(previewText).toBeNull()

    // Should not have timestamp elements
    const timestamps = container.querySelectorAll('[style*="monospace"]')
    expect(timestamps.length).toBe(0)
  })

  it('renders nothing for an empty cron expression', () => {
    const param = createCronParam()
    renderWithProvider(
      <SchemaField
        param={param}
        value=""
        onChange={() => {}}
      />,
    )

    const previewText = screen.queryByText(/Next.*fire time/i)
    expect(previewText).toBeNull()
  })

  it('renders correctly for common cron patterns', () => {
    const param = createCronParam()
    const patterns = [
      '* * * * *',       // Every minute
      '0 * * * *',       // Every hour
      '0 0 * * *',       // Daily at midnight
      '0 12 * * *',      // Daily at noon
      '0 0 * * 0',       // Weekly on Sunday
      '0 0 1 * *',       // Monthly on the 1st
      '0 9-17 * * 1-5',  // Weekdays 9-5
      '*/15 * * * *',    // Every 15 minutes
    ]

    patterns.forEach((pattern) => {
      cleanup()
      const { container } = renderWithProvider(
        <SchemaField
          param={param}
          value={pattern}
          onChange={() => {}}
        />,
      )

      const previewText = screen.queryByText(/Next.*fire time/i)
      expect(previewText).not.toBeNull()

      const timestamps = container.querySelectorAll('[style*="monospace"]')
      expect(timestamps.length).toBeGreaterThan(0)
    })
  })
})
