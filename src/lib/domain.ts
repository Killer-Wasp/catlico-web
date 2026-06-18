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
// Mirrors the backend case status enum (app/models/case_.py): Open | Resolved
// | Duplicated.
export type CaseStatus = 'open' | 'resolved' | 'duplicated'
