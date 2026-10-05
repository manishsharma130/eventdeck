import { beforeEach, afterEach, expect, it, vi } from 'vitest'
vi.mock('../src/config/environment', () => ({ environment: { apiUrl: '', websocketUrl: 'ws://localhost/ws' } }))

beforeEach(() => {
  vi.resetModules()
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  })
})
afterEach(() => vi.unstubAllGlobals())

it('defines independent default tags and persists custom definitions across reloads', async () => {
  const { useEventTagsStore: tags } = await import('../src/state/event-tags-store')
  expect(tags.getState().definitions.map(t => [t.name, t.value])).toEqual([
    ['Google Analytics', 'google_analytics'], ['Branch', 'branch'], ['MoEngage', 'moengage'],
  ])
  tags.getState().addTag('Property Events', 'property')
  expect(tags.getState().definitions.at(-1)).toMatchObject({ name: 'Property Events', value: 'property', type: 'custom' })
  vi.resetModules()
  const reloaded = (await import('../src/state/event-tags-store')).useEventTagsStore
  expect(reloaded.getState().definitions.at(-1)?.value).toBe('property')
  reloaded.getState().deleteTag(reloaded.getState().definitions.at(-1)!.id)
  vi.resetModules()
  expect((await import('../src/state/event-tags-store')).useEventTagsStore.getState().definitions).toHaveLength(3)
})

it('rejects blank and duplicate values and protects predefined tags', async () => {
  const { useEventTagsStore: tags } = await import('../src/state/event-tags-store')
  expect(() => tags.getState().addTag('', 'x')).toThrow('required')
  expect(() => tags.getState().addTag('Test', '  ')).toThrow('required')
  expect(() => tags.getState().addTag('Other name', 'branch')).toThrow('already exists')
  expect(() => tags.getState().deleteTag('branch')).toThrow('cannot be deleted')
  tags.getState().addTag('Property', 'property')
  expect(() => tags.getState().addTag('Duplicate', 'property')).toThrow('already exists')
})

it('keeps unknown events and does not register tags implicitly or modify events when deleting definitions', async () => {
  const { useEventTagsStore: tags, matchesEventTag } = await import('../src/state/event-tags-store')
  const { useLiveStreamStore: stream } = await import('../src/state/live-stream-store')
  for (const eventTag of ['property', 'some_unknown_tag', 'google_analytics']) {
    stream.getState().handleMessage({ type: 'live_stream.event', version: 1, timestamp: 123, payload: { eventName: 'open', eventTag, eventParams: {} } })
  }
  expect(tags.getState().definitions).toHaveLength(3)
  const events = stream.getState().events
  expect(events.filter(e => matchesEventTag(e.tag, null))).toHaveLength(3)
  tags.getState().addTag('Property Events', 'property')
  expect(events.filter(e => matchesEventTag(e.tag, 'property'))).toHaveLength(1)
  tags.getState().deleteTag(tags.getState().definitions.at(-1)!.id)
  expect(stream.getState().events).toBe(events)
  expect(events.filter(e => matchesEventTag(e.tag, null))).toHaveLength(3)
  expect(matchesEventTag('Property', 'property')).toBe(false)
})

it('supports literal All Tags as a custom value without confusing the unfiltered selection', async () => {
  const { useEventTagsStore: tags, matchesEventTag } = await import('../src/state/event-tags-store')
  tags.getState().addTag('Literal tag', 'All Tags')
  expect(matchesEventTag('property', 'All Tags')).toBe(false)
  expect(matchesEventTag('All Tags', 'All Tags')).toBe(true)
  expect(matchesEventTag('property', null)).toBe(true)
})

it('does not update the list when saving fails', async () => {
  const { useEventTagsStore: tags } = await import('../src/state/event-tags-store')
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage full') })
  expect(() => tags.getState().addTag('Property', 'property')).toThrow('Storage full')
  expect(tags.getState().definitions).toHaveLength(3)
})
