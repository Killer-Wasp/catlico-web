/**
 * Bounded-concurrency task pool. Runs `worker` over every item with at most
 * `concurrency` in flight at once, and always resolves — like
 * `Promise.allSettled`, results come back in input order and a rejection never
 * aborts the batch. Used to fan out plugin-run dispatches without firing
 * hundreds of unbounded requests.
 */
export async function allSettledPooled<T, TResult>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<TResult>,
  concurrency = 5,
): Promise<PromiseSettledResult<TResult>[]> {
  const results = new Array<PromiseSettledResult<TResult>>(items.length)
  let next = 0

  async function drain(): Promise<void> {
    while (next < items.length) {
      const index = next++
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) }
      } catch (reason) {
        results[index] = { status: 'rejected', reason }
      }
    }
  }

  const lanes = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: lanes }, () => drain()))
  return results
}
