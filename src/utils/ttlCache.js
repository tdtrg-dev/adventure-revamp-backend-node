/**
 * Minimal in-process TTL cache, mirroring Laravel's Cache::remember() usage for
 * the Ticketmaster result pools (bucketed by rounded coordinate + filters so
 * nearby callers share an entry). No Redis in this project (see the plan's
 * "no Redis/BullMQ" decision) — an in-memory Map is a fine substitute for a
 * short-lived, non-critical cache like this one.
 */
const store = new Map();

async function remember(key, ttlMs, factory) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await factory();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

module.exports = { remember };
