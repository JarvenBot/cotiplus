// Unified storage: uses Electron file-based store when available, localStorage otherwise.

declare global {
  interface Window {
    cotiStore?: {
      load: () => Record<string, unknown>
      save: (data: Record<string, unknown>) => boolean
    }
  }
}

const isElectron = typeof window !== 'undefined' && !!window.cotiStore

// In-memory cache of the full store (Electron mode)
let _cache: Record<string, unknown> | null = null

function getCache(): Record<string, unknown> {
  if (_cache === null) {
    _cache = isElectron ? (window.cotiStore!.load() ?? {}) : {}
  }
  return _cache
}

function flushCache(): void {
  if (isElectron && _cache !== null) {
    window.cotiStore!.save(_cache)
  }
}

export function storeGet<T>(key: string, fallback: T): T {
  if (isElectron) {
    const cache = getCache()
    return key in cache ? (cache[key] as T) : fallback
  }
  try {
    const raw = localStorage.getItem(key)
    return raw !== null ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function storeSet(key: string, value: unknown): void {
  if (isElectron) {
    const cache = getCache()
    cache[key] = value
    flushCache()
    return
  }
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}
