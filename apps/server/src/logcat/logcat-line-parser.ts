import type { LogcatEntry } from './logcat.types.js'

/** threadtime has no year: use the nearest adjacent year around New Year. */
export function parseLogcatEntry(raw: string, now = Date.now()): LogcatEntry | null {
  const match = raw.match(/^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+([^:]+):\s?(.*)$/)
  if (!match) return null
  const [, month, day, hour, minute, second, ms, pid, tid, level, tag, message] = match
  const year = new Date(now).getFullYear()
  const dates = [year - 1, year, year + 1].map(y => new Date(y, +month - 1, +day, +hour, +minute, +second, +ms))
    .filter(d => d.getMonth() === +month - 1 && d.getDate() === +day && d.getHours() === +hour && d.getMinutes() === +minute && d.getSeconds() === +second)
  if (!dates.length) return null
  dates.sort((a, b) => Math.abs(+a - now) - Math.abs(+b - now))
  return { timestamp: +dates[0], pid: +pid, tid: +tid, level: level as LogcatEntry['level'], tag: tag.trim(), message, raw }
}
