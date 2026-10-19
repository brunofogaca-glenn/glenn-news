import { get, put } from "@vercel/blob";

export type SupplementalRefreshMeta = {
  status: "fresh" | "stale";
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  persistent: boolean;
  lastError?: string;
};

type Envelope<T> = { version: 1; savedAt: string; value: T };
const PREFIX = "glenn-news/supplemental-snapshots/";
const pending = new Map<string, Promise<unknown>>();

function pathFor(key: string) {
  return PREFIX + key.replace(/[^a-z0-9-]/gi, "-") + ".json";
}

function stripMeta<T extends Record<string, unknown>>(value: T): T {
  const { refreshMeta: _meta, ...clean } = value as T & { refreshMeta?: SupplementalRefreshMeta };
  return clean as T;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function warningsOf(value: Record<string, unknown>) {
  const candidate = value.warnings;
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((item): item is string =>
    typeof item === "string" && item.trim().length > 0
  );
}

const VOLATILE_SNAPSHOT_KEYS = new Set([
  "updatedAt",
  "fetchedAt",
  "checkedAt",
  "generatedAt",
  "lastAttemptAt",
  "lastSuccessAt",
]);

function comparableSnapshotContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparableSnapshotContent);
  if (typeof value !== "object" || value === null) return value;

  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .filter(key => key !== "refreshMeta" && !VOLATILE_SNAPSHOT_KEYS.has(key))
      .sort()
      .map(key => [key, comparableSnapshotContent(record[key])])
  );
}

function snapshotsHaveSameContent(previous: unknown, current: unknown) {
  return JSON.stringify(comparableSnapshotContent(previous)) ===
    JSON.stringify(comparableSnapshotContent(current));
}

async function read<T extends Record<string, unknown>>(key: string): Promise<Envelope<T> | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await get(pathFor(key), { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    if (text.length > 1_500_000) return null;
    const value = JSON.parse(text) as Partial<Envelope<T>>;
    if (value.version !== 1 || typeof value.savedAt !== "string" ||
        !value.value || typeof value.value !== "object" || Array.isArray(value.value)) return null;
    return { version: 1, savedAt: value.savedAt, value: stripMeta(value.value as T) };
  } catch {
    return null;
  }
}

async function write<T extends Record<string, unknown>>(key: string, value: T, savedAt: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await put(pathFor(key), JSON.stringify({ version: 1, savedAt, value: stripMeta(value) }), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
    });
    return true;
  } catch (error) {
    console.warn("Kunde inte spara beständig faktacache:", key, error);
    return false;
  }
}

export async function withLastGoodSnapshot<T extends Record<string, unknown>>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T & { refreshMeta: SupplementalRefreshMeta }> {
  const inProgress = pending.get(key) as Promise<T & { refreshMeta: SupplementalRefreshMeta }> | undefined;
  if (inProgress) return inProgress;

  const task = (async () => {
    const attemptedAt = new Date().toISOString();
    try {
      const value = stripMeta(await fetcher());
      const warnings = warningsOf(value);
      if (warnings.length > 0) {
        const previous = await read<T>(key);
        return {
          ...(previous?.value ?? value),
          refreshMeta: {
            status: "stale" as const,
            lastAttemptAt: attemptedAt,
            lastSuccessAt: previous?.savedAt ?? null,
            persistent: Boolean(previous),
            lastError: warnings.join("; ").slice(0, 500),
          },
        };
      }

      const previous = await read<T>(key);
      const savedAt = new Date().toISOString();
      // Blob PUTs are advanced operations. Preserve the last-good snapshot
      // when the payload has not materially changed; volatile fetch timestamps
      // are excluded from this comparison. Reads are in the larger simple-op quota.
      const unchanged = Boolean(previous && snapshotsHaveSameContent(previous.value, value));
      const persistent = unchanged ? true : await write(key, value, savedAt);
      return { ...value, refreshMeta: { status: "fresh" as const, lastAttemptAt: attemptedAt, lastSuccessAt: savedAt, persistent } };
    } catch (error) {
      const previous = await read<T>(key);
      if (!previous) throw error;
      return {
        ...previous.value,
        refreshMeta: {
          status: "stale" as const,
          lastAttemptAt: attemptedAt,
          lastSuccessAt: previous.savedAt,
          persistent: true,
          lastError: message(error).slice(0, 500),
        },
      };
    }
  })();

  pending.set(key, task);
  try {
    return await task;
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}
