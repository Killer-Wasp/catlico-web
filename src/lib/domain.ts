/**
 * Shared domain primitives used across features (alerts, cases, observables,
 * templates…). These are the small, cross-cutting types and their canonical
 * lookup tables — kept in one place so a value's home never depends on which
 * feature imported it first.
 */

// --- Severity --------------------------------------------------------------
// Severity scale: 1 = lowest. Index by severity number → semantic name.
export type Severity = 1 | 2 | 3 | 4

export const SEV: Record<Severity, string> = {
  1: 'low',
  2: 'medium',
  3: 'high',
  4: 'critical',
}

// --- TLP / PAP -------------------------------------------------------------
// Traffic Light Protocol level. PAP (Permissible Actions Protocol) shares the
// same 0–3 scale and label set.
export type Tlp = 0 | 1 | 2 | 3
export type Pap = 0 | 1 | 2 | 3

// TLP/PAP level → name.
export const TLP: Record<Tlp, string> = {
  0: 'white',
  1: 'green',
  2: 'amber',
  3: 'red',
}

// --- Case status -----------------------------------------------------------
// Custom case statuses are org-scoped rows in the backend `case_status` lookup
// (app/models/case_status.py). Consumers branch on the semantic `stage`; the
// label + colour drive the badge. Built-ins: Open / In progress / Resolved /
// Duplicated.
export type CaseStage = 'open' | 'in_progress' | 'closed' | 'duplicated'

/** A resolved case-status reference, as embedded in case read models. */
export type CaseStatusRef = {
  id: number
  label: string
  stage: CaseStage
  color: string
}

// --- Shared select options + colour maps -----------------------------------
// Reusable, cross-feature presentation constants derived from the domain
// scales above. Feature pages import these instead of redeclaring their own
// copies (alerts, cases, observables, create-case…).

// Severity filter/select options, highest first. Values are the severity
// number as a string (the form controls speak strings).
export const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: '4', label: 'Critical' },
  { value: '3', label: 'High' },
  { value: '2', label: 'Medium' },
  { value: '1', label: 'Low' },
]

// TLP (and PAP — same scale) filter/select options, most restrictive first.
export const TLP_OPTIONS: { value: string; label: string }[] = [
  { value: '3', label: 'RED' },
  { value: '2', label: 'AMBER' },
  { value: '1', label: 'GREEN' },
  { value: '0', label: 'WHITE' },
]

// TLP level name (see `TLP`) → Mantine palette colour for badges.
export const TLP_COLOR: Record<string, string> = {
  red: 'red',
  amber: 'yellow',
  green: 'green',
  white: 'gray',
}
