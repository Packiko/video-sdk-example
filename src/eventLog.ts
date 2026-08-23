// Tiny in-page event log so every SDK call/state change is visible with a
// plain-language hint — the "what just happened?" panel for integrators.
export interface LogEntry {
  at: string
  source: string // 'recorder' | 'playback' | 'queue' | 'sw'
  message: string
  hint?: string
}

let entries: readonly LogEntry[] = []
const listeners = new Set<() => void>()

export function logEvent(source: LogEntry['source'], message: string, hint?: string): void {
  entries = [...entries, { at: new Date().toLocaleTimeString(), source, message, hint }]
  listeners.forEach((l) => l())
}

export const getLog = () => entries
export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
