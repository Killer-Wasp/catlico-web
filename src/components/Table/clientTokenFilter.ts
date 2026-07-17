/**
 * clientTokenFilter.ts — shared client-side matching for the token filter bar.
 *
 * The server-side list views (cases, alerts, …) turn tokens into a backend
 * clause query. The plugin views are small, fully-loaded lists, so they filter
 * in the browser instead — but they should still honour the same token
 * semantics the shared TokenSearch UI implies:
 *
 *   • values within one field OR together
 *   • different fields AND together
 *
 * A page supplies a `match(item, token)` predicate for a single token; this
 * helper handles the grouping so every client-side list agrees on the meaning
 * of a pill set.
 */

import type { Token } from '#/components/Table/TokenSearch'

export type TokenMatcher<T> = (item: T, token: Token) => boolean

/** Group tokens by their field key, preserving insertion order per group. */
function groupByField(tokens: Token[]): Token[][] {
  const byField = new Map<string, Token[]>()
  for (const t of tokens) {
    const group = byField.get(t.field) ?? []
    group.push(t)
    byField.set(t.field, group)
  }
  return [...byField.values()]
}

/**
 * Filter `items` by the active `tokens`: an item is kept when, for every field
 * group, it matches at least one token in that group. An empty token list
 * passes everything through.
 */
export function filterByTokens<T>(
  items: T[],
  tokens: Token[],
  match: TokenMatcher<T>,
): T[] {
  if (tokens.length === 0) return items
  const groups = groupByField(tokens)
  return items.filter((item) =>
    groups.every((group) => group.some((t) => match(item, t))),
  )
}

/** Standard text-field match: `eq` exact, `co` (default) substring, over `hay`. */
export function matchText(token: Token, ...hay: string[]): boolean {
  const v = token.value.toLowerCase()
  const fields = hay.map((s) => s.toLowerCase())
  return token.op === 'eq'
    ? fields.some((h) => h === v)
    : fields.some((h) => h.includes(v))
}
