/**
 * Unit tests for buildForm.ts — pure zod compiler.
 * Covers: rule matrix, value precedence, dirty-keys, secret contract.
 */
import { describe, it, expect } from 'vitest'
import {
  buildFormSchema,
  buildDirtyPayload,
  describeFieldType,
  isSecretParam,
  isEnvLocked,
} from './buildForm'
import type { PluginConfigParam } from '#/components/Plugins/plugins.types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function param(overrides: Partial<PluginConfigParam> = {}): PluginConfigParam {
  return {
    name: 'test_field',
    description: 'Test field',
    type: 'string',
    required: false,
    ...overrides,
  }
}

function validate(schema: ReturnType<typeof buildFormSchema>, values: Record<string, unknown>) {
  return schema.zodSchema.safeParse(values)
}

// ── isSecretParam / isEnvLocked ─────────────────────────────────────────────

describe('isSecretParam', () => {
  it('returns true for type=secret', () => {
    expect(isSecretParam(param({ type: 'secret' }))).toBe(true)
  })
  it('returns true for the secret:true boolean flag (real manifest shape)', () => {
    expect(isSecretParam(param({ type: 'string', secret: true }))).toBe(true)
  })
  it('returns false for other types', () => {
    expect(isSecretParam(param({ type: 'string' }))).toBe(false)
    expect(isSecretParam(param({ type: 'integer' }))).toBe(false)
    expect(isSecretParam(param({ type: 'boolean' }))).toBe(false)
  })
})

describe('isEnvLocked', () => {
  it('returns true for source=environment', () => {
    expect(isEnvLocked(param({ source: 'environment' }))).toBe(true)
  })
  it('returns false for other sources', () => {
    expect(isEnvLocked(param({ source: 'org' }))).toBe(false)
    expect(isEnvLocked(param())).toBe(false)
  })
})

// ── Initial value precedence ────────────────────────────────────────────────

describe('buildFormSchema — initial values', () => {
  it('uses current value when provided', () => {
    const params = [param({ name: 'api_key' })]
    const result = buildFormSchema(params, { api_key: 'sk-123' })
    expect(result.initialValues).toEqual({ api_key: 'sk-123' })
  })

  it('falls back to schema default', () => {
    const params = [param({ name: 'ttl', defaultValue: 300 })]
    const result = buildFormSchema(params, {})
    expect(result.initialValues).toEqual({ ttl: 300 })
  })

  it('falls back to type-appropriate empty for booleans', () => {
    const params = [param({ name: 'flag', type: 'boolean' })]
    const result = buildFormSchema(params, {})
    expect(result.initialValues).toEqual({ flag: false })
  })

  it('falls back to type-appropriate empty for numbers', () => {
    const params = [param({ name: 'count', type: 'integer' })]
    const result = buildFormSchema(params, {})
    expect(result.initialValues).toEqual({ count: undefined })
  })

  it('falls back to empty string for defaults', () => {
    const params = [param({ name: 'label' })]
    const result = buildFormSchema(params, {})
    expect(result.initialValues).toEqual({ label: '' })
  })

  it('current value beats schema default', () => {
    const params = [param({ name: 'host', defaultValue: 'default.io' })]
    const result = buildFormSchema(params, { host: 'custom.io' })
    expect(result.initialValues).toEqual({ host: 'custom.io' })
  })

  it('includes env-locked params in initial values', () => {
    const params = [param({ name: 'region', source: 'environment', defaultValue: 'us-east-1' })]
    const result = buildFormSchema(params, {})
    expect(result.initialValues).toEqual({ region: 'us-east-1' })
  })
})

// ── Zod schema — validation rules ───────────────────────────────────────────

describe('buildFormSchema — validation rules', () => {
  it('string param accepts any string', () => {
    const params = [param({ name: 'host' })]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { host: 'example.com' }).success).toBe(true)
    expect(validate(schema, { host: '' }).success).toBe(true) // not required
  })

  it('required string rejects empty', () => {
    const params = [param({ name: 'host', required: true })]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { host: '' }).success).toBe(false)
    expect(validate(schema, { host: 'x' }).success).toBe(true)
  })

  it('pattern is compiled and enforced', () => {
    const params = [param({ name: 'ip', pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$' })]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { ip: '192.168.1.1' }).success).toBe(true)
    expect(validate(schema, { ip: 'not-an-ip' }).success).toBe(false)
  })

  it('bad pattern degrades to no-op', () => {
    const params = [param({ name: 'x', pattern: '[' })] // Invalid regex
    const schema = buildFormSchema(params, {})
    // Should not crash — degrades to plain string validation
    expect(validate(schema, { x: 'anything' }).success).toBe(true)
  })

  it('integer validates number and int', () => {
    const params = [param({ name: 'count', type: 'integer' })]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { count: 42 }).success).toBe(true)
    expect(validate(schema, { count: 3.14 }).success).toBe(false)
    expect(validate(schema, { count: 'abc' }).success).toBe(false)
  })

  it('integer min/max bounds', () => {
    const params = [param({ name: 'count', type: 'integer', required: true, min: 1, max: 10 })]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { count: 0 }).success).toBe(false)
    expect(validate(schema, { count: 11 }).success).toBe(false)
    expect(validate(schema, { count: 5 }).success).toBe(true)
  })

  it('float accepts decimal', () => {
    const params = [param({ name: 'rate', type: 'float' })]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { rate: 3.14 }).success).toBe(true)
    expect(validate(schema, { rate: 42 }).success).toBe(true)
  })

  it('boolean param validates boolean', () => {
    const params = [param({ name: 'flag', type: 'boolean' })]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { flag: true }).success).toBe(true)
    expect(validate(schema, { flag: false }).success).toBe(true)
    expect(validate(schema, { flag: 'yes' }).success).toBe(false)
  })

  it('enum validates against choices', () => {
    const params = [param({ name: 'mode', choices: ['auto', 'manual', 'off'] })]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { mode: 'auto' }).success).toBe(true)
    expect(validate(schema, { mode: 'nope' }).success).toBe(false)
  })

  it('multiselect validates array of choices', () => {
    const params = [
      param({ name: 'tags', choices: ['a', 'b', 'c'], type: 'array', defaultValue: [] }),
    ]
    const schema = buildFormSchema(params, {})
    expect(validate(schema, { tags: ['a', 'b'] }).success).toBe(true)
    expect(validate(schema, { tags: ['a', 'x'] }).success).toBe(false)
  })

  it('secret params get no zod validation', () => {
    const params = [param({ name: 'token', type: 'secret' })]
    const schema = buildFormSchema(params, {})
    // Secret should not appear in the zod schema at all
    expect(schema.zodSchema.shape.token).toBeUndefined()
  })

  it('env-locked params get no zod validation', () => {
    const params = [param({ name: 'region', source: 'environment' })]
    const schema = buildFormSchema(params, {})
    expect(schema.zodSchema.shape.region).toBeUndefined()
  })

  it('combines multiple params', () => {
    const params = [
      param({ name: 'host', required: true }),
      param({ name: 'port', type: 'integer', min: 1, max: 65535 }),
    ]
    const schema = buildFormSchema(params, { host: '', port: 0 })
    expect(validate(schema, { host: '', port: 0 }).success).toBe(false)
    expect(validate(schema, { host: 'x', port: 0 }).success).toBe(false)
    expect(validate(schema, { host: 'x', port: 8080 }).success).toBe(true)
  })
})

// ── describeFieldType ───────────────────────────────────────────────────────

describe('describeFieldType', () => {
  it('maps secret type', () => expect(describeFieldType(param({ type: 'secret' }))).toBe('secret'))
  it('maps environment source', () => expect(describeFieldType(param({ source: 'environment' }))).toBe('environment'))
  it('maps boolean type', () => expect(describeFieldType(param({ type: 'boolean' }))).toBe('boolean'))
  it('maps integer type', () => expect(describeFieldType(param({ type: 'integer' }))).toBe('number'))
  it('maps float type', () => expect(describeFieldType(param({ type: 'float' }))).toBe('number'))
  it('maps number type', () => expect(describeFieldType(param({ type: 'number' }))).toBe('number'))
  it('maps multiline', () => expect(describeFieldType(param({ multiline: true }))).toBe('multiline'))
  it('maps choices (single)', () => expect(describeFieldType(param({ choices: ['a', 'b'] }))).toBe('select'))
  it('maps choices (array)', () => expect(describeFieldType(param({ type: 'array', choices: ['a', 'b'] }))).toBe('multiselect'))
  it('maps cron type', () => expect(describeFieldType(param({ type: 'cron' }))).toBe('cron'))
  it('maps array (tags)', () => expect(describeFieldType(param({ type: 'array' }))).toBe('tags'))
  it('defaults to text', () => expect(describeFieldType(param({}))).toBe('text'))
})

// ── Dirty-keys payload ──────────────────────────────────────────────────────

describe('buildDirtyPayload', () => {
  it('omits unchanged fields', () => {
    const params = [param({ name: 'host' })]
    const payload = buildDirtyPayload(params, { host: 'example.com' }, { host: 'example.com' })
    expect(payload).toEqual({}) // no dirty keys
  })

  it('includes changed fields', () => {
    const params = [param({ name: 'host' })]
    const payload = buildDirtyPayload(params, { host: 'old' }, { host: 'new' })
    expect(payload).toEqual({ settings: { host: 'new' } })
  })

  it('includes only changed fields among many', () => {
    const params = [
      param({ name: 'host' }),
      param({ name: 'port', type: 'integer' }),
    ]
    const payload = buildDirtyPayload(
      params,
      { host: 'old', port: 8080 },
      { host: 'new', port: 8080 },
    )
    expect(payload).toEqual({ settings: { host: 'new' } })
  })

  it('omits unchanged secret fields', () => {
    const params = [param({ name: 'token', type: 'secret' })]
    const payload = buildDirtyPayload(
      params,
      { token: '' },
      {}, // token not in currentValues → not dirty
    )
    expect(payload).toEqual({})
  })

  it('includes changed secret as string replacement', () => {
    const params = [param({ name: 'token', type: 'secret' })]
    const payload = buildDirtyPayload(
      params,
      { token: '' },
      { token: 'sk-new' },
    )
    expect(payload).toEqual({ secrets: { token: 'sk-new' } })
  })

  it('includes secret as null for deletion', () => {
    const params = [param({ name: 'token', type: 'secret' })]
    const payload = buildDirtyPayload(
      params,
      { token: '' },
      { token: null },
    )
    expect(payload).toEqual({ secrets: { token: null } })
  })

  it('omits empty string secrets (keep stored)', () => {
    const params = [param({ name: 'token', type: 'secret' })]
    const payload = buildDirtyPayload(
      params,
      { token: '' },
      { token: '' },
    )
    expect(payload).toEqual({})
  })

  it('omits env-locked fields from payload', () => {
    const params = [
      param({ name: 'host' }),
      param({ name: 'region', source: 'environment' }),
    ]
    const payload = buildDirtyPayload(
      params,
      { host: 'old', region: 'us-east-1' },
      { host: 'new', region: 'us-east-1' },
    )
    expect(payload).toEqual({ settings: { host: 'new' } })
  })

  it('returns empty payload when nothing is dirty', () => {
    const params = [param({ name: 'a' }), param({ name: 'b', type: 'integer' })]
    const payload = buildDirtyPayload(params, { a: '', b: 0 }, { a: '', b: 0 })
    expect(payload).toEqual({})
  })
})
