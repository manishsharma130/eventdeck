export interface SelectedFlowRepository {
  listIds(): string[]
  replace(flowIds: string[], createdAt: number, createId: () => string): void
}
