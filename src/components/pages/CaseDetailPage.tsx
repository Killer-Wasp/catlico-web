import type { CaseDetail } from '#/components/Cases/caseDetails.types'
import classes from '#/components/Cases/CasesPage.module.css'
import { Box, Group, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { CaseBody } from './case-detail/CaseBody'
import { CaseSideRail } from './case-detail/CaseSideRail'
import { CaseSummaryCard } from './case-detail/CaseSummaryCard'

export { CASE_TABS, type CaseTab } from './case-detail/constants'
export { CaseTabPanel } from './case-detail/CaseBody'

export function CaseDetailPage({
  caseDetail,
  caseId,
}: {
  caseDetail: CaseDetail
  caseId: string
}) {
  return (
    <Box className={classes.page}>
      <Group gap={8} mb={16}>
        <Text
          component={Link}
          to="/cases"
          ff="monospace"
          fz={12}
          c="dimmed"
          td="none"
        >
          &larr; Cases
        </Text>
        <Text ff="monospace" fz={12} c="dimmed">
          /
        </Text>
        <Text ff="monospace" fz={12} c="dimmed">
          {caseDetail.id}
        </Text>
      </Group>

      <CaseSummaryCard caseDetail={caseDetail} caseId={caseId} />

      <Box className={classes.caseDetailLayout} mt="md">
        <CaseBody caseDetail={caseDetail} caseId={caseId} />
        <CaseSideRail caseDetail={caseDetail} />
      </Box>
    </Box>
  )
}
