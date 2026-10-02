import type { Flow } from '../domain/flow.types.js'

export interface FlowRepository {
  create(flow: Flow): Flow
  update(flow: Flow): Flow
  delete(id: string): boolean
  deleteMany(ids: string[]): number
  findById(id: string): Flow | null
  findByName(name: string): Flow | null
  findManyByIds(ids: string[]): Flow[]
  list(search?: string): Flow[]
}
