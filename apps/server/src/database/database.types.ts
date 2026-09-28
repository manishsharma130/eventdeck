export interface Database {
  transaction<T>(operation: () => T): T
  isHealthy(): boolean
  close(): void
}
