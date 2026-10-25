import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";

const CACHE_PREFIX = "glenn-news/week-focus/cache/";
function stockholmDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value ?? "2000";
  const month = parts.find(part => part.type === "month")?.value ?? "01";
  const day = parts.find(part => part.type === "day")?.value ?? "01";
  return year + "-" + month + "-" + day;
}
function cachePath(dateKey: string) {
  return CACHE_PREFIX + dateKey + ".json";
}
const MAX_MEMORY_ENTRIES = 3;
type CacheEnvelope = {
  version: 2;
  dateKey: string;
  fingerprint: string;
  cachedAt: string;
  value: unknown;
};

// Keyed by Stockholm calendar date: the first generated edition stays fixed all day.
const memoryCache = new Map<string, { value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return '"[undefined]"';
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : JSON.stringify(String(value));
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableSerialize).join(",") + "]";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map(key =>
      JSON.stringify(key) + ":" + stableSerialize(record[key])
    ).join(",") + "}";
  }
  return JSON.stringify(String(value));
}

/** Stable SHA-256 key for the actual editorial inputs, independent of object key order. */
export function createWeeklyFocusFingerprint(input: unknown): string {
  return createHash("sha256").update(stableSerialize(input)).digest("hex");
}

function remember(dateKey: string, value: unknown) {
  memoryCache.delete(dateKey);
  memoryCache.set(dateKey, { value });
  while (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const firstKey = memoryCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    memoryCache.delete(firstKey);
  }
}

async function readPersistentCache<T>(
  dateKey: string,
  isValid: (value: unknown) => value is T
): Promise<T | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const result = await get(cachePath(dateKey), { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;
    const parsed = JSON.parse(await new Response(result.stream).text()) as Partial<CacheEnvelope>;
    const cachedAt = typeof parsed.cachedAt === "string" ? Date.parse(parsed.cachedAt) : Number.NaN;
    if (
      parsed.version !== 2 ||
      parsed.dateKey !== dateKey ||
      !Number.isFinite(cachedAt) ||
      Date.now() < cachedAt ||
      stockholmDateKey(new Date(cachedAt)) !== dateKey ||
      !isValid(parsed.value)
    ) {
      return null;
    }
    remember(dateKey, parsed.value);
    return parsed.value;
  } catch {
    return null;
  }
}

async function writePersistentCache(dateKey: string, fingerprint: string, value: unknown) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;

  const envelope: CacheEnvelope = {
    version: 2,
    dateKey,
    fingerprint,
    cachedAt: new Date().toISOString(),
    value,
  };
  try {
    await put(cachePath(dateKey), JSON.stringify(envelope), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch (error) {
    // Cache failures must not turn a successful editorial result into a page error.
    console.warn("Kunde inte spara WeekFocus-cache:", error);
  }
}

/**
 * Generate one Week Focus edition per Stockholm calendar day. The first request
 * persists a snapshot; later requests reuse it even if reading activity or the
 * profile changes during the day. Same-instance requests coalesce.
 */
export async function getOrCreateWeeklyFocus<T>(
  fingerprint: string,
  create: () => Promise<T>,
  isValid: (value: unknown) => value is T
): Promise<T> {
  const dateKey = stockholmDateKey();
  const cached = memoryCache.get(dateKey);
  if (cached && isValid(cached.value)) return cached.value;
  if (cached) memoryCache.delete(dateKey);

  const existingPromise = inFlight.get(dateKey);
  if (existingPromise) return existingPromise as Promise<T>;

  const task = (async () => {
    const persistedValue = await readPersistentCache(dateKey, isValid);
    if (persistedValue !== null) return persistedValue;

    const value = await create();
    if (isValid(value)) {
      remember(dateKey, value);
      await writePersistentCache(dateKey, fingerprint, value);
    }
    return value;
  })();

  inFlight.set(dateKey, task);
  try {
    return await task;
  } finally {
    if (inFlight.get(dateKey) === task) inFlight.delete(dateKey);
  }
}
