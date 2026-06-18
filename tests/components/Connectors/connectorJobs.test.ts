import {
  countConnectorJobsByTab,
  filterConnectorJobsByTab,
  initialConnectorJobs,
} from '#/components/Connectors/connectorJobs'
import { describe, expect, test } from 'vitest'

describe('connector jobs data helpers', () => {
  test('filters connector jobs by status tab', () => {
    expect(filterConnectorJobsByTab(initialConnectorJobs, 'all')).toHaveLength(8)
    expect(filterConnectorJobsByTab(initialConnectorJobs, 'queued')).toHaveLength(
      1,
    )
    expect(
      filterConnectorJobsByTab(initialConnectorJobs, 'running'),
    ).toHaveLength(2)
    expect(filterConnectorJobsByTab(initialConnectorJobs, 'success')).toHaveLength(
      4,
    )
    expect(filterConnectorJobsByTab(initialConnectorJobs, 'failure')).toHaveLength(
      1,
    )
  })

  test('counts connector jobs by status tab', () => {
    expect(countConnectorJobsByTab(initialConnectorJobs)).toEqual({
      all: 8,
      queued: 1,
      running: 2,
      success: 4,
      failure: 1,
    })
  })
})
