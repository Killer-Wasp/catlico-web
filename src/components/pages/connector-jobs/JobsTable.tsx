import type { ConnectorJob } from '#/components/Connectors/connectorJobs.types'
import { Button, Table } from '@mantine/core'
import { ObservableCell, StatusPill, VerdictCell } from './Cells'
import { isTerminal } from './constants'
import styles from './styles.module.css'

export function JobsTable({
  jobs,
  isLoading,
  isEmpty,
  onOpenReport,
  onCancel,
  cancelPendingId,
}: {
  jobs: ConnectorJob[]
  isLoading: boolean
  isEmpty: boolean
  onOpenReport: (id: string) => void
  onCancel: (id: string) => void
  cancelPendingId: string | null
}) {
  return (
    <Table.ScrollContainer minWidth={1020}>
      <Table
        highlightOnHover
        horizontalSpacing="lg"
        verticalSpacing="md"
        borderColor="var(--line-soft)"
      >
        <Table.Thead>
          <Table.Tr>
            <Table.Th className={styles.columnHeader}>Job</Table.Th>
            <Table.Th className={styles.columnHeader}>Observable</Table.Th>
            <Table.Th className={styles.columnHeader}>Plugin</Table.Th>
            <Table.Th className={styles.columnHeader}>Status</Table.Th>
            <Table.Th className={styles.columnHeader}>Verdict</Table.Th>
            <Table.Th className={styles.columnHeader}>Started</Table.Th>
            <Table.Th className={styles.columnHeader}>Duration</Table.Th>
            <Table.Th aria-label="Actions" />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {jobs.map((job) => (
            <Table.Tr
              key={job.id}
              tabIndex={0}
              style={{
                cursor: isTerminal(job.status) ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (isTerminal(job.status)) onOpenReport(job.id)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && isTerminal(job.status)) {
                  onOpenReport(job.id)
                }
              }}
            >
              <Table.Td
                ff="monospace"
                fz={12}
                fw={700}
                c="var(--muted)"
                style={{ whiteSpace: 'nowrap' }}
              >
                {job.ref}
              </Table.Td>
              <Table.Td maw={420}>
                <ObservableCell job={job} />
              </Table.Td>
              <Table.Td fw={600}>{job.plugin}</Table.Td>
              <Table.Td>
                <StatusPill job={job} />
              </Table.Td>
              <Table.Td>
                <VerdictCell verdict={job.verdict} />
              </Table.Td>
              <Table.Td
                ff="monospace"
                fz={12}
                c="dimmed"
                style={{ whiteSpace: 'nowrap' }}
              >
                {job.started ?? '-'}
              </Table.Td>
              <Table.Td
                ff="monospace"
                fz={12}
                c="dimmed"
                style={{ whiteSpace: 'nowrap' }}
              >
                {job.duration ?? '-'}
              </Table.Td>
              <Table.Td ta="right" onClick={(event) => event.stopPropagation()}>
                {isTerminal(job.status) ? (
                  <Button
                    variant="default"
                    size="xs"
                    onClick={() => onOpenReport(job.id)}
                  >
                    Report
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="xs"
                    loading={cancelPendingId === job.id}
                    onClick={() => onCancel(job.id)}
                  >
                    Cancel
                  </Button>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
          {isEmpty && (
            <Table.Tr>
              <Table.Td colSpan={8} ta="center" c="dimmed" fz={13} py={42}>
                {isLoading
                  ? 'Loading analyzer jobs…'
                  : 'No analyzer jobs match this queue.'}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  )
}
