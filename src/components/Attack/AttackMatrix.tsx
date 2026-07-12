/**
 * The tactics × techniques grid, in two modes:
 *  - heatmap: read view — cells shaded by org case count, click opens details
 *  - picker: selection view — cells toggle membership in `selectedIds`
 * Layout: one horizontally scrollable row of tactic columns (ATT&CK Navigator
 * style). Data shaping happens in buildMatrix; this renders it.
 */
import type { MatrixColumn, MatrixTechnique } from './buildMatrix'
import { Badge, Box, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { Fragment } from 'react'

export type AttackMatrixProps = {
  columns: MatrixColumn[]
  mode: 'heatmap' | 'picker'
  /** Selected technique external ids (picker mode). */
  selectedIds?: Set<string>
  /** Toggle a technique in/out of the selection (picker mode). */
  onToggle?: (externalId: string) => void
  /** Open a technique's detail drawer (heatmap mode). */
  onOpenTechnique?: (externalId: string) => void
  /** Case-insensitive name/id filter; non-matching cells are hidden. */
  search?: string
}

export function AttackMatrix({
  columns,
  mode,
  selectedIds,
  onToggle,
  onOpenTechnique,
  search,
}: AttackMatrixProps) {
  const maxCount = Math.max(
    1,
    ...columns.flatMap((c) =>
      c.techniques.flatMap((t) => [
        t.caseCount,
        ...t.subtechniques.map((s) => s.caseCount),
      ]),
    ),
  )
  const q = search?.trim().toLowerCase() ?? ''
  const matches = (t: MatrixTechnique) =>
    q === '' ||
    t.name.toLowerCase().includes(q) ||
    t.externalId.toLowerCase().includes(q)

  return (
    <Group align="flex-start" gap="xs" wrap="nowrap" style={{ overflowX: 'auto' }}>
      {columns.map((col) => {
        const visible = col.techniques.filter(
          (t) => matches(t) || t.subtechniques.some(matches),
        )
        if (visible.length === 0) return null
        return (
          <Stack key={col.tactic} gap={4} miw={168} maw={200}>
            <Text fw={700} fz={13} ta="center" py={4}>
              {col.label}
            </Text>
            {visible.map((t) => (
              <Fragment key={t.externalId}>
                <TechniqueCell
                  technique={t}
                  mode={mode}
                  maxCount={maxCount}
                  selected={selectedIds?.has(t.externalId) ?? false}
                  onClick={() =>
                    mode === 'picker'
                      ? onToggle?.(t.externalId)
                      : onOpenTechnique?.(t.externalId)
                  }
                />
                {t.subtechniques.filter(matches).map((s) => (
                  <Box key={s.externalId} pl="md">
                    <TechniqueCell
                      technique={s}
                      mode={mode}
                      maxCount={maxCount}
                      selected={selectedIds?.has(s.externalId) ?? false}
                      onClick={() =>
                        mode === 'picker'
                          ? onToggle?.(s.externalId)
                          : onOpenTechnique?.(s.externalId)
                      }
                    />
                  </Box>
                ))}
              </Fragment>
            ))}
          </Stack>
        )
      })}
    </Group>
  )
}

function TechniqueCell({
  technique,
  mode,
  maxCount,
  selected,
  onClick,
}: {
  technique: MatrixTechnique
  mode: 'heatmap' | 'picker'
  maxCount: number
  selected: boolean
  onClick: () => void
}) {
  const heat =
    mode === 'heatmap' && technique.caseCount > 0
      ? 0.15 + 0.6 * (technique.caseCount / maxCount)
      : 0
  return (
    <UnstyledButton
      onClick={onClick}
      data-selected={selected ? 'true' : undefined}
      aria-label={`${technique.externalId} ${technique.name}`}
      p={6}
      style={{
        borderRadius: 4,
        border: selected
          ? '1px solid var(--mantine-color-blue-6)'
          : '1px solid var(--mantine-color-default-border)',
        backgroundColor:
          heat > 0
            ? `light-dark(rgba(220, 60, 60, ${heat}), rgba(255, 120, 110, ${heat}))`
            : selected
              ? 'var(--mantine-color-blue-light)'
              : undefined,
      }}
    >
      <Group gap={6} wrap="nowrap" justify="space-between">
        <Text fz={12} lineClamp={2}>
          {technique.name}
        </Text>
        {technique.caseCount > 0 && mode === 'heatmap' ? (
          <Badge size="xs" variant="filled" color="gray" radius="xl">
            {technique.caseCount}
          </Badge>
        ) : null}
      </Group>
      <Text ff="monospace" fz={10} c="dimmed">
        {technique.externalId}
      </Text>
    </UnstyledButton>
  )
}
