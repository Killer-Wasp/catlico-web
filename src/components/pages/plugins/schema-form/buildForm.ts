/**
 * schema-form/buildForm.ts
 *
 * Pure zod compiler: parameter schema + config_status → { initialValues, zodSchema }.
 * Consumed via @mantine/form + the built-in schemaResolver.
 *
 * Design:
 *  - Initial value precedence:  org-config value → schema default → type-appropriate empty
 *  - Rule compilation: required→non-empty; min/max→number bounds; pattern→regex (bad regex
 *    degrades to no-op); choices→enum
 *  - Dirty-keys-only submit: buildDirtyPayload() compares current vs initial and emits only
 *    changed keys. Secret contract: absent key keeps, string replaces, null deletes.
 *  - Environment-locked params carry display metadata only — never validated or submitted.
 *  - Pure, tested without rendering.
 */

import { z } from 'zod'
import type {
  PluginConfigParam,
  ParamConfigStatus,
  ConfigPayload,
} from '#/components/Plugins/plugins.types'

// ── Exported types ──────────────────────────────────────────────────────────

export type BuildFormResult = {
  initialValues: Record<string, unknown>
  zodSchema: z.ZodObject<Record<string, z.ZodTypeAny>>
}

export type FieldType =
  | 'text'
  | 'multiline'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'tags'
  | 'secret'
  | 'cron'
  | 'environment'

// ── Param classification helpers ────────────────────────────────────────────

export function isSecretParam(param: PluginConfigParam): boolean {
  // Manifests express secrets either as `type: "secret"` or a `secret: true`
  // boolean flag on a typed field — both must route to the secret contract.
  return param.type === 'secret' || param.secret === true
}

export function isEnvLocked(param: PluginConfigParam): boolean {
  return param.source === 'environment'
}

// ── Initial value resolution ────────────────────────────────────────────────

function getInitialValue(
  param: PluginConfigParam,
  currentValues: Record<string, unknown>,
): unknown {
  // 1. Org-config (current) value takes precedence
  if (param.name in currentValues) return currentValues[param.name]
  // 2. Schema default
  if (param.defaultValue !== undefined) return param.defaultValue
  // 3. Type-appropriate empty
  if (param.type === 'boolean') return false
  if (param.type === 'integer' || param.type === 'float' || param.type === 'number') return undefined
  if (param.choices && param.choices.length) return []
  if (param.type === 'array') return []
  return ''
}

// ── Zod schema builder per param ────────────────────────────────────────────

function buildParamZodSchema(param: PluginConfigParam): z.ZodTypeAny | null {
  // Secrets and env-locked params get no client-side validation
  if (isSecretParam(param)) return null
  if (isEnvLocked(param)) return null

  switch (param.type) {
    case 'boolean':
      return z.boolean()

    case 'integer': {
      let schema = z.number().int()
      if (param.min !== undefined) { schema = schema.min(param.min) }
      if (param.max !== undefined) { schema = schema.max(param.max) }
      return param.required ? schema : schema.optional()
    }

    case 'float':
    case 'number': {
      let schema = z.number()
      if (param.min !== undefined) { schema = schema.min(param.min) }
      if (param.max !== undefined) { schema = schema.max(param.max) }
      return param.required ? schema : schema.optional()
    }

    default: {
      // ── string-based types ─────────────────────────────────────────────
      if (param.choices && param.choices.length > 0) {
        const enumTuple = param.choices as [string, ...string[]]
        if (param.type === 'array' || Array.isArray(param.defaultValue)) {
          return z.array(z.enum(enumTuple))
        }
        return z.enum(enumTuple)
      }

      if (param.type === 'array') {
        // Free-form array (no choices): valid as long as it's an array
        return z.array(z.string()).optional()
      }

      // Default: string
      let s: z.ZodString = z.string()

      if (param.required) {
        s = s.min(1, 'Required')
      }

      if (param.pattern) {
        try {
          s = s.regex(new RegExp(param.pattern))
        } catch {
          // Bad server regex degrades to no-op — never crashes the drawer
        }
      }

      if (param.type === 'cron') {
        // Cron gets basic non-empty + pattern check; the server owns full validation
        s = s.min(1, 'Required')
      }

      return s
    }
  }
}

// ── Main compiler ───────────────────────────────────────────────────────────

export function buildFormSchema(
  params: PluginConfigParam[],
  currentValues: Record<string, unknown> = {},
  _configStatus?: Record<string, ParamConfigStatus>,
): BuildFormResult {
  const shape: Record<string, z.ZodTypeAny> = {}
  const initialValues: Record<string, unknown> = {}

  for (const param of params) {
    initialValues[param.name] = getInitialValue(param, currentValues)
    const schema = buildParamZodSchema(param)
    if (schema) shape[param.name] = schema
  }

  return {
    initialValues,
    zodSchema: z.object(shape),
  }
}

// ── Field type descriptor (used by Field.tsx) ───────────────────────────────

export function describeFieldType(param: PluginConfigParam): FieldType {
  if (isEnvLocked(param)) return 'environment'
  if (isSecretParam(param)) return 'secret'
  if (param.type === 'cron') return 'cron'
  if (param.type === 'boolean') return 'boolean'
  if (param.type === 'integer' || param.type === 'float' || param.type === 'number') return 'number'
  if (param.multiline) return 'multiline'
  if (param.choices && param.choices.length > 0) {
    if (param.type === 'array' || Array.isArray(param.defaultValue)) return 'multiselect'
    return 'select'
  }
  if (param.type === 'array') return 'tags'
  return 'text'
}

// ── Dirty-keys payload builder ──────────────────────────────────────────────

/**
 * Compare `currentValues` (form state) against `initialValues` and emit a
 * ConfigPayload with only changed keys.
 *
 * Secret contract:
 *  - Absent from currentValues → omit from secrets (keep stored)
 *  - Non-empty string in currentValues → include as replacement
 *  - null in currentValues → include null (server deletes the stored secret)
 */
export function buildDirtyPayload(
  params: PluginConfigParam[],
  initialValues: Record<string, unknown>,
  currentValues: Record<string, unknown>,
): ConfigPayload {
  const settings: Record<string, unknown> = {}
  const secrets: Record<string, string | null> = {}

  for (const param of params) {
    if (isEnvLocked(param)) continue

    const key = param.name
    const current = currentValues[key]
    const initial = initialValues[key]

    if (isSecretParam(param)) {
      // Only include if the field was touched (key exists in currentValues)
      if (!(key in currentValues)) continue
      // Empty or undefined means "keep stored secret" → omit
      if (current === '' || current === undefined) continue
      secrets[key] = current === null ? null : String(current)
      continue
    }

    // Non-secret: include only if changed
    if (current === initial) continue
    // Value equivalence for primitives via string coercion; use
    // JSON.stringify for arrays to avoid ','-within-value ambiguity.
    const eq = Array.isArray(current) && Array.isArray(initial)
      ? JSON.stringify(current) === JSON.stringify(initial)
      : String(current) === String(initial)
    if (eq) continue
    settings[key] = current
  }

  const payload: ConfigPayload = {}
  if (Object.keys(settings).length > 0) payload.settings = settings
  if (Object.keys(secrets).length > 0) payload.secrets = secrets
  return payload
}
