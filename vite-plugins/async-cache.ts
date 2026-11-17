export interface AsyncCache<T> {
  getOrLoad: (key: string, bypassCache: boolean, loader: () => Promise<T>) => Promise<T>
  set: (key: string, value: T) => void
  clear: () => void
}

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export function createAsyncCache<T>(ttlMs: number): AsyncCache<T> {
  const store = new Map<string, CacheEntry<T>>()
  const inflight = new Map<string, Promise<T>>()

  return {
    getOrLoad(key: string, bypassCache: boolean, loader: () => Promise<T>): Promise<T> {
      const now = Date.now()
      if (!bypassCache) {
        const hit = store.get(key)
        if (hit && hit.expiresAt > now) {
          return Promise.resolve(hit.value)
        }
        const pending = inflight.get(key)
        if (pending) {
          return pending
        }
      }

      const promise = loader()
        .then((value) => {
          store.set(key, { value, expiresAt: Date.now() + ttlMs })
          return value
        })
        .finally(() => {
          inflight.delete(key)
        })

      inflight.set(key, promise)
      return promise
    },
    set(key: string, value: T): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
    },
    clear(): void {
      store.clear()
      inflight.clear()
    },
  }
}
