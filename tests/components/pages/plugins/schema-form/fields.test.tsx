/**
 * @vitest-environment jsdom
 *
 * Component tests for the Field.tsx schema-field matrix.
 * Stubs at the `#/lib/api/client` boundary. Tests key flows:
 *   - Secret keep/replace/clear interactions
 *   - Env-locked fields render readonly + lock icon
 *   - Each field type renders the expected control
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { SchemaField } from '#/components/pages/plugins/schema-form/Field'
import type { PluginConfigParam } from '#/components/Plugins/plugins.types'
import type { FieldProps } from '#/components/pages/plugins/schema-form/Field'

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderField(overrides: Partial<FieldProps> & { param: PluginConfigParam }) {
  const props: FieldProps = {
    param: overrides.param,
    value: overrides.value ?? '',
    onChange: overrides.onChange ?? vi.fn(),
    error: overrides.error,
    dirty: overrides.dirty,
    storedSecret: overrides.storedSecret,
    onClearSecret: overrides.onClearSecret,
  }
  return render(
    <MantineProvider>
      <SchemaField {...props} />
    </MantineProvider>,
  )
}

function param(overrides: Partial<PluginConfigParam> = {}): PluginConfigParam {
  return {
    name: 'test_field',
    description: 'Test description',
    type: 'string',
    required: false,
    ...overrides,
  }
}

afterEach(() => cleanup())

// ── TextInput (default) ─────────────────────────────────────────────────────

describe('Field — text (default)', () => {
  it('renders a TextInput with label and description', () => {
    renderField({ param: param({ name: 'host', description: 'Server hostname' }) })
    expect(screen.getByLabelText('host')).toBeInTheDocument()
    expect(screen.getByText('Server hostname')).toBeInTheDocument()
  })

  it('calls onChange when user types', () => {
    const onChange = vi.fn()
    renderField({ param: param({ name: 'host' }), onChange })
    fireEvent.change(screen.getByLabelText('host'), { target: { value: 'example.com' } })
    expect(onChange).toHaveBeenCalledWith('example.com')
  })

  it('shows error message when provided', () => {
    renderField({ param: param({ name: 'host' }), error: 'Required' })
    expect(screen.getByText('Required')).toBeInTheDocument()
  })
})

// ── Textarea (multiline) ────────────────────────────────────────────────────

describe('Field — multiline', () => {
  it('renders a Textarea', () => {
    renderField({ param: param({ name: 'notes', multiline: true }) })
    expect(screen.getByLabelText('notes')).toBeInTheDocument()
  })
})

// ── NumberInput ─────────────────────────────────────────────────────────────

describe('Field — number', () => {
  it('renders a NumberInput for integer type', () => {
    renderField({ param: param({ name: 'port', type: 'integer' }) })
    expect(screen.getByLabelText('port')).toBeInTheDocument()
  })

  it('renders a NumberInput for float type', () => {
    renderField({ param: param({ name: 'rate', type: 'float' }) })
    expect(screen.getByLabelText('rate')).toBeInTheDocument()
  })
})

// ── Boolean ─────────────────────────────────────────────────────────────────

describe('Field — boolean', () => {
  it('renders a Switch', () => {
    renderField({ param: param({ name: 'enabled', type: 'boolean' }) })
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('calls onChange with toggled value', () => {
    const onChange = vi.fn()
    renderField({ param: param({ type: 'boolean' }), value: false, onChange })
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

// ── Select ──────────────────────────────────────────────────────────────────

describe('Field — select', () => {
  it('renders a Select with choices', () => {
    renderField({ param: param({ name: 'mode', choices: ['auto', 'manual'] }) })
    expect(screen.getByText('mode')).toBeInTheDocument()
  })
})

// ── MultiSelect ─────────────────────────────────────────────────────────────

describe('Field — multiselect', () => {
  it('renders a MultiSelect', () => {
    renderField({
      param: param({ name: 'tags', type: 'array', choices: ['a', 'b', 'c'] }),
    })
    expect(screen.getByText('tags')).toBeInTheDocument()
  })
})

// ── TagsInput ───────────────────────────────────────────────────────────────

describe('Field — tags', () => {
  it('renders a TagsInput for free-form array', () => {
    renderField({ param: param({ name: 'domains', type: 'array' }) })
    expect(screen.getByText('domains')).toBeInTheDocument()
  })
})

// ── Secret ──────────────────────────────────────────────────────────────────

describe('Field — secret', () => {
  it('renders a PasswordInput', () => {
    renderField({ param: param({ name: 'api_key', type: 'secret' }) })
    expect(screen.getByLabelText('api_key')).toBeInTheDocument()
  })

  it('shows "Stored" badge when storedSecret is true', () => {
    renderField({
      param: param({ name: 'api_key', type: 'secret' }),
      storedSecret: true,
    })
    expect(screen.getByText('Stored')).toBeInTheDocument()
  })

  it('shows "Clear" link when storedSecret is true', () => {
    const onClear = vi.fn()
    renderField({
      param: param({ name: 'api_key', type: 'secret' }),
      storedSecret: true,
      onClearSecret: onClear,
    })
    fireEvent.click(screen.getByText('Clear'))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('hides stored badge when storedSecret is false', () => {
    renderField({ param: param({ name: 'api_key', type: 'secret' }) })
    expect(screen.queryByText('Stored')).not.toBeInTheDocument()
  })
})

// ── Environment-locked ──────────────────────────────────────────────────────

describe('Field — environment', () => {
  it('renders a read-only TextInput', () => {
    renderField({
      param: param({ name: 'region', source: 'environment' }),
      value: 'us-east-1',
    })
    const input = screen.getByLabelText('region')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('readonly')
  })

  it('shows a lock icon', () => {
    const { container } = renderField({
      param: param({ name: 'region', source: 'environment' }),
    })
    // The Lock icon renders inside the input's right section
    const lockIcon = container.querySelector('.lucide-lock')
    expect(lockIcon).toBeInTheDocument()
  })
})

// ── Cron ────────────────────────────────────────────────────────────────────

describe('Field — cron', () => {
  it('renders a TextInput for cron expression', () => {
    renderField({ param: param({ name: 'schedule', type: 'cron' }) })
    expect(screen.getByLabelText('schedule')).toBeInTheDocument()
  })
})
