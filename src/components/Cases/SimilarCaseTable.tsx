import type {
  CaseStatusRef,
  Severity as SeverityLevel,
} from '#/lib/domain'
import { Severity } from '#/components/Severity/Severity'
import { StatusBadge } from '#/components/StatusBadge/StatusBadge'
import { Table, Text } from '@mantine/core'

/** A case sharing one or more observables with the current alert/case. */
export type SimilarCaseRow = {
  id: string
  title: string
  sev: SeverityLevel
  status: CaseStatusRef | null
}

/**
 * The "Similar cases" table, shared by the alert detail drawer and the case
 * detail "Similar" tab. Each row links out to the case via `onOpen`.
 */
export function SimilarCaseTable({
  rows,
  onOpen,
}: {
  rows: SimilarCaseRow[]
  onOpen: (id: string) => void
}) {
  if (rows.length === 0) {
    return (
      <Text fz={13} c="dimmed">
        No similar cases found.
      </Text>
    )
  }
  return (
    <Table.ScrollContainer minWidth={0}>
      <Table verticalSpacing={7} fz={13} highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Case</Table.Th>
            <Table.Th>Title</Table.Th>
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((similar) => (
            <Table.Tr
              key={similar.id}
              onClick={() => onOpen(similar.id)}
              style={{ cursor: 'pointer' }}
            >
              <Table.Td>
                <Severity id={similar.id} sev={similar.sev} />
              </Table.Td>
              <Table.Td>
                <Text fz={13} fw={500} truncate maw={200}>
                  {similar.title}
                </Text>
              </Table.Td>
              <Table.Td>
                {similar.status ? (
                  <StatusBadge
                    label={similar.status.label}
                    color={similar.status.color}
                  />
                ) : null}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
