import {
  filterConnectorsByTab,
  initialConnectors,
} from './connectorsData'
import { describe, expect, test } from 'vitest'

describe('connectors data helpers', () => {
  test('filters connectors by catalog tab', () => {
    expect(filterConnectorsByTab(initialConnectors, 'all')).toHaveLength(12)
    expect(filterConnectorsByTab(initialConnectors, 'analyzers')).toHaveLength(
      8,
    )
    expect(filterConnectorsByTab(initialConnectors, 'responders')).toHaveLength(
      4,
    )
    expect(filterConnectorsByTab(initialConnectors, 'disabled')).toHaveLength(1)
  })
})
