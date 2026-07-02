import type { RowData } from '@tanstack/react-table'

// Per-column responsive/alignment overrides carried on the column def so
// both the header and body cells stay in sync. Shared by the case / alert /
// observable tables via this global module augmentation.
export type CaseColumnMeta = {
  visibleFrom?: string
  ta?: 'left' | 'center' | 'right'
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> extends CaseColumnMeta {
    _t?: [TData, TValue]
  }
}
