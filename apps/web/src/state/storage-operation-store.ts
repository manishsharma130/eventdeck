import { create } from 'zustand'
import { api, type StorageOperation, type StorageStatus } from '../services/api'

type StorageOperationState = {
  status: StorageStatus | null
  setStatus(status: StorageStatus): void
  setOperation(operation: StorageOperation): void
  hydrate(): Promise<void>
}

let hydrationSequence = 0

export const useStorageOperationStore = create<StorageOperationState>((set) => ({
  status: null,
  setStatus: status => set({ status }),
  setOperation: operation => set(state => ({
    status: {
      deletionAllowed: operation.status !== 'RUNNING' && (state.status?.blockers.filter(blocker => blocker !== 'DELETION_ACTIVE').length ?? 0) === 0,
      blockers: operation.status === 'RUNNING'
        ? [...new Set([...(state.status?.blockers ?? []), 'DELETION_ACTIVE' as const])]
        : (state.status?.blockers.filter(blocker => blocker !== 'DELETION_ACTIVE') ?? []),
      operation,
    },
  })),
  hydrate: async () => {
    const sequence = ++hydrationSequence
    try {
      const status = await api.storageStatus()
      if (sequence === hydrationSequence) set({ status })
    }
    catch { /* Keep the last server-owned state until the connection recovers. */ }
  },
}))
