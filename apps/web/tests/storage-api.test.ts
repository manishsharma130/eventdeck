import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../src/config/environment', () => ({ environment: { apiUrl: '' } }))
import { api } from '../src/services/api'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('keeps storage calculations async and forwards navigation cancellation to fetch', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { setTimeout, clearTimeout })
  let requestSignal!: AbortSignal
  vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
    requestSignal = init.signal
    requestSignal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')))
  })))
  const controller = new AbortController()
  const pending = api.storage(controller.signal)
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.advanceTimersByTimeAsync(15_000)
  expect(requestSignal.aborted).toBe(false)
  controller.abort()
  await rejected
  expect(requestSignal.aborted).toBe(true)
})
