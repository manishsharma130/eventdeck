import type { Flow } from '../domain/flow.types.js'

export interface FlowRepository {
  create(flow: Flow): Flow
  update(flow: Flow): Flow
  delete(id: string): boolean
  findById(id: string): Flow | null
  findByName(name: string): Flow | null
  list(search?: string): Flow[]
}
