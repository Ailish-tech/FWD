// Small in-memory GET cache. Keys include the auth token, and the whole cache
// is cleared on login/logout and after any write.
const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached(key: string, value: unknown) {
  store.set(key, value);
}

export function clearCache() {
  store.clear();
}
