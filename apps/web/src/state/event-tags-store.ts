import { create } from 'zustand'

export type EventTagDefinition = { id: string; name: string; value: string; type: 'predefined' | 'custom' }
export const PREDEFINED_EVENT_TAGS: EventTagDefinition[] = [
  { id: 'google-analytics', name: 'Google Analytics', value: 'google_analytics', type: 'predefined' },
  { id: 'branch', name: 'Branch', value: 'branch', type: 'predefined' },
  { id: 'moengage', name: 'MoEngage', value: 'moengage', type: 'predefined' },
]
const STORAGE_KEY = 'eventdeck.event-tags.v1'

function readCustomTags(): EventTagDefinition[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(saved)) return []
    const values = new Set(PREDEFINED_EVENT_TAGS.map(tag => tag.value))
    const ids = new Set(PREDEFINED_EVENT_TAGS.map(tag => tag.id))
    return saved.filter((tag): tag is EventTagDefinition => {
      if (!tag || tag.type !== 'custom' || typeof tag.id !== 'string' || !tag.id || typeof tag.name !== 'string' || !tag.name.trim() || typeof tag.value !== 'string' || !tag.value.trim() || values.has(tag.value) || ids.has(tag.id)) return false
      values.add(tag.value); ids.add(tag.id)
      return true
    })
  } catch { return [] }
}

type EventTagsState = {
  definitions: EventTagDefinition[]
  addTag(name: string, value: string): void
  deleteTag(id: string): void
}

export const useEventTagsStore = create<EventTagsState>((set, get) => {
  const save = (definitions: EventTagDefinition[]) => {
    // Do not claim a successful save if browser storage is unavailable or full.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(definitions.filter(tag => tag.type === 'custom')))
    set({ definitions })
  }
  return {
    definitions: [...PREDEFINED_EVENT_TAGS, ...readCustomTags()],
    addTag(name, value) {
      const displayName = name.trim()
      if (!displayName || !value.trim()) throw new Error('Tag Name and Tag Value are required.')
      if (get().definitions.some(tag => tag.value === value)) throw new Error('A tag with this value already exists.')
      save([...get().definitions, { id: `custom-${crypto.randomUUID()}`, name: displayName, value, type: 'custom' }])
    },
    deleteTag(id) {
      const tag = get().definitions.find(tag => tag.id === id)
      if (!tag) return
      if (tag.type === 'predefined') throw new Error('Predefined tags cannot be deleted.')
      save(get().definitions.filter(tag => tag.id !== id))
    },
  }
})

/** Unknown tags still match All Tags. Definitions never modify event data. */
export function matchesEventTag(eventTag: string, selectedValue: string | null): boolean {
  return selectedValue === null || eventTag === selectedValue
}

if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
