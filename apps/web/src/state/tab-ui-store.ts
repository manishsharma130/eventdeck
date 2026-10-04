import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { create } from 'zustand'

type TabId = 'live' | 'rules' | 'build' | 'execution' | 'recordings' | 'settings'
type TabUiState = {
  values: Record<string, unknown>
  setValue: (key: string, value: unknown) => void
}

const useTabUiStore = create<TabUiState>((set) => ({
  values: {},
  setValue: (key, value) => set((state) => ({ values: { ...state.values, [key]: value } })),
}))

/**
 * Local UI state that survives route unmounts for the lifetime of the application.
 * Screens remain unmounted while hidden, avoiding background DOM/rendering costs.
 */
export function useTabState<T>(tab: TabId, key: string, initialValue: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const storeKey = `${tab}:${key}`
  const initialRef = useRef<T | undefined>(undefined)
  if (initialRef.current === undefined) initialRef.current = initialValue instanceof Function ? initialValue() : initialValue
  const value = useTabUiStore((state) => state.values[storeKey] as T | undefined) ?? initialRef.current
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    const current = (useTabUiStore.getState().values[storeKey] as T | undefined) ?? initialRef.current as T
    useTabUiStore.getState().setValue(storeKey, next instanceof Function ? next(current) : next)
  }, [storeKey])
  return [value as T, setValue]
}
