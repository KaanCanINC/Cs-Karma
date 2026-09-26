// Basit TTL cache (Nuvio runtime uzun omurlu: TMDB tekrarlarini onler).
export function createTtlCache(defaultTtlMs = 30 * 60 * 1000, maxEntries = 300) {
  const map = new Map();
  function prune() {
    const now = Date.now();
    for (const [k, v] of map) {
      if (v.exp <= now) map.delete(k);
    }
    while (map.size > maxEntries) {
      const first = map.keys().next().value;
      map.delete(first);
    }
  }
  return {
    async remember(key, loader, ttlMs, cacheIf) {
      const now = Date.now();
      const hit = map.get(key);
      if (hit && hit.exp > now) return hit.val;
      const val = await loader();
      try {
        if (cacheIf && !cacheIf(val)) return val;
      } catch { /* ignore */ }
      prune();
      map.set(key, { val, exp: now + (ttlMs || defaultTtlMs) });
      return val;
    }
  };
}
