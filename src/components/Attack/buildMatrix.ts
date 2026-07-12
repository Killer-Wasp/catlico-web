/**
 * Pure transform: flat ATT&CK catalog + per-technique case counts ->
 * ordered tactic columns for the matrix. No fetching, no React — unit-tested
 * in isolation (tests/components/Attack/buildMatrix.test.ts).
 */
import type { PatternDto } from './attackQueries'

/**
 * Canonical enterprise kill-chain order (matrix column order), tracking the
 * current MITRE ATT&CK Enterprise taxonomy (x-mitre-matrix tactic_refs):
 * 15 tactics. Note TA0005 was renamed "Defense Evasion" -> "Stealth" and
 * TA0112 "Defense Impairment" was added; there is no longer a
 * `defense-evasion` slug. Any technique tagged with a tactic NOT in this list
 * is surfaced in a trailing column by buildMatrix rather than dropped.
 */
export const TACTIC_ORDER = [
  'reconnaissance',
  'resource-development',
  'initial-access',
  'execution',
  'persistence',
  'privilege-escalation',
  'stealth',
  'defense-impairment',
  'credential-access',
  'discovery',
  'lateral-movement',
  'collection',
  'command-and-control',
  'exfiltration',
  'impact',
] as const

export type MatrixTechnique = {
  externalId: string
  name: string
  url: string
  description: string
  caseCount: number
  subtechniques: MatrixTechnique[]
}

export type MatrixColumn = {
  tactic: string
  label: string
  techniques: MatrixTechnique[]
}

// MITRE canonical column headers that don't follow plain Title-Case.
const LABEL_OVERRIDES: Record<string, string> = {
  'command-and-control': 'Command and Control',
}

const labelFor = (slug: string) =>
  LABEL_OVERRIDES[slug] ??
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

const isSubtechnique = (p: PatternDto) => p.parent_external_id != null

function toCell(p: PatternDto, stats: Record<string, number>): MatrixTechnique {
  return {
    externalId: p.external_id,
    name: p.name,
    url: p.url,
    description: p.description,
    caseCount: stats[p.external_id] ?? 0,
    subtechniques: [],
  }
}

export function buildMatrix(
  catalog: PatternDto[],
  stats: Record<string, number>,
): MatrixColumn[] {
  const subsByParent = new Map<string, PatternDto[]>()
  for (const p of catalog) {
    if (!isSubtechnique(p)) continue
    const list = subsByParent.get(p.parent_external_id!) ?? []
    list.push(p)
    subsByParent.set(p.parent_external_id!, list)
  }

  const buildColumn = (tactic: string): MatrixColumn | null => {
    const techniques = catalog
      .filter((p) => !isSubtechnique(p) && p.tactics.includes(tactic))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const cell = toCell(p, stats)
        // Subtechniques follow their parent: they nest under it in every column
        // the parent appears in, regardless of the subtechnique's own tactics.
        // A subtechnique whose parent is absent from the catalog is silently
        // dropped (can't happen with well-formed ATT&CK data).
        cell.subtechniques = (subsByParent.get(p.external_id) ?? [])
          .slice()
          .sort((a, b) => a.external_id.localeCompare(b.external_id))
          .map((s) => toCell(s, stats))
        return cell
      })
    if (techniques.length === 0) return null
    return { tactic, label: labelFor(tactic), techniques }
  }

  const columns: MatrixColumn[] = []
  for (const tactic of TACTIC_ORDER) {
    const column = buildColumn(tactic)
    if (column) columns.push(column)
  }

  // Resilience: never silently drop techniques tagged with a tactic slug we
  // don't yet know about (e.g. a future MITRE taxonomy change). Collect any
  // such unknown slugs and append them as trailing columns (sorted for
  // determinism) so those techniques always surface somewhere in the matrix.
  const known = new Set<string>(TACTIC_ORDER)
  const unknown = new Set<string>()
  for (const p of catalog) {
    if (isSubtechnique(p)) continue
    for (const tactic of p.tactics) {
      if (!known.has(tactic)) unknown.add(tactic)
    }
  }
  for (const tactic of [...unknown].sort((a, b) => a.localeCompare(b))) {
    const column = buildColumn(tactic)
    if (column) columns.push(column)
  }

  return columns
}
