// Tiny in-process TTL cache for hot, read-mostly endpoints.
const store = new Map<string, { expiresAt: number; value: unknown }>();
const DEFAULT_TTL_MS = 30_000;

export function projectListKey(workspaceId: string): string {
  return `projects:${workspaceId}`;
}

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { expiresAt: Date.now() + ttlMs, value });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}
