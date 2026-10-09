export interface LogcatEntry {
  timestamp: number
  pid?: number
  tid?: number
  level: 'V' | 'D' | 'I' | 'W' | 'E' | 'F'
  tag: string
  message: string
  raw: string
}
