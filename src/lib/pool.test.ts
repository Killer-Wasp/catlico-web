import { describe, it, expect, vi } from 'vitest'
import { allSettledPooled } from './pool'

describe('allSettledPooled', () => {
  it('runs the worker once per item and returns results in input order', async () => {
    const worker = vi.fn(async (n: number) => n * 2)
    const results = await allSettledPooled([1, 2, 3, 4], worker, 2)

    expect(worker).toHaveBeenCalledTimes(4)
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([
      2, 4, 6, 8,
    ])
  })

  it('never exceeds the concurrency cap yet still processes every item', async () => {
    let inFlight = 0
    let peak = 0
    const worker = vi.fn(async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 1))
      inFlight--
    })

    const items = Array.from({ length: 20 }, (_, i) => i)
    const results = await allSettledPooled(items, worker, 5)

    expect(worker).toHaveBeenCalledTimes(20)
    expect(results).toHaveLength(20)
    expect(peak).toBeLessThanOrEqual(5)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })

  it('resolves to an empty array for empty input without hanging', async () => {
    const worker = vi.fn()
    const results = await allSettledPooled([], worker, 5)
    expect(results).toEqual([])
    expect(worker).not.toHaveBeenCalled()
  })

  it('works when the concurrency cap exceeds the item count', async () => {
    const worker = vi.fn(async (n: number) => n + 1)
    const results = await allSettledPooled([1, 2], worker, 10)
    expect(worker).toHaveBeenCalledTimes(2)
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([
      2, 3,
    ])
  })

  it('collects rejections without aborting the rest of the batch', async () => {
    const worker = vi.fn(async (n: number) => {
      if (n === 2) throw new Error('boom')
      return n
    })
    const results = await allSettledPooled([1, 2, 3], worker, 3)

    expect(worker).toHaveBeenCalledTimes(3)
    expect(results[0].status).toBe('fulfilled')
    expect(results[1].status).toBe('rejected')
    expect(results[2].status).toBe('fulfilled')
  })
})
