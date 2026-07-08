import type { RowData } from '@tanstack/react-table'

// Per-column responsive/alignment overrides carried on the column def so
// both the header and body cells stay in sync. Shared by all list tables.
export type TableColumnMeta = {
  visibleFrom?: string
  ta?: 'left' | 'center' | 'right'
  /** Size this column to its content and prevent wrapping. */
  nowrap?: boolean
  /** Reduce horizontal table padding for narrow utility columns. */
  compact?: boolean
  /** Let this column absorb the remaining table width. */
  grow?: boolean
  /** Preserve readability for content that must not visually collapse. */
  minWidth?: number | string
}

// Keep the old name as an alias so existing satisfies sites keep compiling
// until they're updated.
export type CaseColumnMeta = TableColumnMeta

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> extends TableColumnMeta {
    _t?: [TData, TValue]
  }
}
