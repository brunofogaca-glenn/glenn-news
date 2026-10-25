import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";

const CACHE_PATH = "glenn-news/week-focus/cache/latest.json";
const MAX_MEMORY_ENTRIES = 3;
// A typical weekend Week Focus reading session is about 15 minutes; keep the
// edition reusable for an hour without serving an unchanged cache forever.
const WEEK_FOCUS_CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEnvelope = {
  version: 1;
  fingerprint: string;
  cachedAt: string;
  value: unknown;
};

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();
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

function remember(fingerprint: string, value: unknown, cachedAt = Date.now()) {
  memoryCache.delete(fingerprint);
  memoryCache.set(fingerprint, { expiresAt: cachedAt + WEEK_FOCUS_CACHE_TTL_MS, value });
  while (memoryCache.size > MAX_MEMORY_ENTRIES) {
    const firstKey = memoryCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    memoryCache.delete(firstKey);
  }
}

async function readPersistentCache<T>(
  fingerprint: string,
  isValid: (value: unknown) => value is T
): Promise<T | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const result = await get(CACHE_PATH, { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;
    const parsed = JSON.parse(await new Response(result.stream).text()) as Partial<CacheEnvelope>;
    const cachedAt = typeof parsed.cachedAt === "string" ? Date.parse(parsed.cachedAt) : Number.NaN;
    if (
      parsed.version !== 1 ||
      parsed.fingerprint !== fingerprint ||
      !Number.isFinite(cachedAt) ||
      Date.now() - cachedAt >= WEEK_FOCUS_CACHE_TTL_MS ||
      Date.now() < cachedAt ||
      !isValid(parsed.value)
    ) {
      return null;
    }
    remember(fingerprint, parsed.value, cachedAt);
    return parsed.value;
  } catch {
    return null;
  }
}

async function writePersistentCache(fingerprint: string, value: unknown) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;

  const envelope: CacheEnvelope = {
    version: 1,
    fingerprint,
    cachedAt: new Date().toISOString(),
    value,
  };
  try {
    await put(CACHE_PATH, JSON.stringify(envelope), {
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
 * Cache successful and fallback editions by their editorial input fingerprint.
 * Same-instance simultaneous requests share one generation promise; persistent
 * Blob storage reuses the result across serverless instances.
 */
export async function getOrCreateWeeklyFocus<T>(
  fingerprint: string,
  create: () => Promise<T>,
  isValid: (value: unknown) => value is T
): Promise<T> {
  const cached = memoryCache.get(fingerprint);
  if (cached && cached.expiresAt > Date.now() && isValid(cached.value)) {
    return cached.value;
  }
  if (cached) memoryCache.delete(fingerprint);

  const existingPromise = inFlight.get(fingerprint);
  if (existingPromise) return existingPromise as Promise<T>;

  const task = (async () => {
    const persistedValue = await readPersistentCache(fingerprint, isValid);
    if (persistedValue !== null) return persistedValue;

    const value = await create();
    if (isValid(value)) {
      remember(fingerprint, value);
      await writePersistentCache(fingerprint, value);
    }
    return value;
  })();

  inFlight.set(fingerprint, task);
  try {
    return await task;
  } finally {
    if (inFlight.get(fingerprint) === task) inFlight.delete(fingerprint);
  }
}
