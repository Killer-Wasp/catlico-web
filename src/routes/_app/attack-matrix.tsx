import { AttackMatrixPage } from '#/components/pages/AttackMatrixPage'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/attack-matrix')({
  component: AttackMatrixPage,
})
