import { createHash, randomUUID } from "node:crypto";
import { get, list, put } from "@vercel/blob";

export type DiagnosticLevel = "error" | "warning";
export type DiagnosticLogEntry = {
  id: string; timestamp: string; level: DiagnosticLevel; component: string;
  message: string; detail?: string; stack?: string;
  context: Record<string, string | number | boolean | null>; fingerprint: string;
};

const PREFIX = "glenn-news/diagnostics/";
const MAX_FILES_PER_DAY = 250;
const MAX_RETURNED_LOGS = 80;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;
const recentFingerprints = new Map<string, number>();
const SAFE_CONTEXT_KEYS = new Set([
  "source", "route", "category", "statusCode", "requestId",
  "attempt", "durationMs", "operation", "articleCount",
]);
const SECRET_ENV_KEYS = [
  "OPENAI_API_KEY", "API_FOOTBALL_KEY", "SPORTMONKS_TOKEN",
  "BLOB_READ_WRITE_TOKEN", "CRON_SECRET", "VERCEL_AUTOMATION_BYPASS_SECRET",
];

function redactText(value: string, maxLength = 2_500) {
  let text = value;
  for (const key of SECRET_ENV_KEYS) {
    const secret = process.env[key];
    if (secret && secret.length >= 8) text = text.split(secret).join("[REDACTED]");
  }
  text = text
    .replace(/\bBearer\s+[^\s,;"']+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9_]{16,})\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*['"]?[^ ,;"'\n]+/gi, "$1=[REDACTED]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, rawUrl => {
      try {
        const parsed = new URL(rawUrl);
        return parsed.origin + parsed.pathname + (parsed.search ? "?[query redacted]" : "");
      } catch {
        return rawUrl.replace(/\?.*$/, "?[query redacted]");
      }
    });
  return text.slice(0, maxLength);
}

function safeContext(input?: Record<string, string | number | boolean | null>) {
  const output: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue;
    if (typeof value === "string") output[key] = redactText(value, 240);
    else if (typeof value === "number" && Number.isFinite(value)) output[key] = value;
    else if (typeof value === "boolean" || value === null) output[key] = value;
  }
  return output;
}

function isLogEntry(value: unknown): value is DiagnosticLogEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<DiagnosticLogEntry>;
  return typeof item.id === "string" &&
    typeof item.timestamp === "string" &&
    Number.isFinite(Date.parse(item.timestamp)) &&
    (item.level === "error" || item.level === "warning") &&
    typeof item.component === "string" &&
    typeof item.message === "string" &&
    typeof item.fingerprint === "string" &&
    Boolean(item.context) && typeof item.context === "object";
}

/** Persist separate incidents so concurrent failures cannot overwrite each other. */
export async function recordDiagnostic(input: {
  level: DiagnosticLevel; component: string; message: string;
  error?: unknown;
  context?: Record<string, string | number | boolean | null>;
}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  const message = redactText(input.message, 800);
  const detailRaw = input.error instanceof Error ? input.error.message :
    input.error === undefined ? "" : String(input.error);
  const detail = detailRaw ? redactText(detailRaw, 1_600) : undefined;
  const stackRaw = input.error instanceof Error ? input.error.stack : undefined;
  const stack = stackRaw ? redactText(stackRaw, 3_500) : undefined;
  const component = redactText(input.component, 100);
  const context = safeContext(input.context);
  const fingerprint = createHash("sha256")
    .update([input.level, component, message, detail ?? ""].join("|"))
    .digest("hex").slice(0, 20);

  const now = Date.now();
  const lastSeen = recentFingerprints.get(fingerprint);
  if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) return false;
  recentFingerprints.set(fingerprint, now);
  if (recentFingerprints.size > 1_000) {
    const oldest = recentFingerprints.keys().next().value;
    if (oldest) recentFingerprints.delete(oldest);
  }

  const timestamp = new Date(now).toISOString();
  const entry: DiagnosticLogEntry = {
    id: randomUUID(), timestamp, level: input.level, component, message,
    ...(detail ? { detail } : {}), ...(stack ? { stack } : {}),
    context, fingerprint,
  };
  const path = PREFIX + timestamp.slice(0, 10) + "/" +
    String(now).padStart(13, "0") + "-" + entry.id + ".json";

  try {
    await put(path, JSON.stringify(entry), {
      access: "private", addRandomSuffix: false, contentType: "application/json",
    });
    return true;
  } catch (error) {
    console.error("Kunde inte spara diagnostiklogg:",
      redactText(error instanceof Error ? error.message : String(error), 500));
    return false;
  }
}

export async function getDiagnosticEvents(days = 1): Promise<{
  available: boolean; entries: DiagnosticLogEntry[]; truncated: boolean; message?: string;
}> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      available: false, entries: [], truncated: false,
      message: "Beständig loggning är inte tillgänglig eftersom Blob-lagringen saknar konfiguration.",
    };
  }

  const safeDays = days === 7 ? 7 : 1;
  const since = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const dates = Array.from({ length: safeDays + 1 }, (_, index) =>
    new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const listings = await Promise.all(dates.map(date =>
    list({ prefix: PREFIX + date + "/", limit: MAX_FILES_PER_DAY })));
  const blobs = listings.flatMap(result => result.blobs)
    .sort((a, b) => b.pathname.localeCompare(a.pathname));
  const truncated = blobs.length > MAX_RETURNED_LOGS;
  const candidates = blobs.slice(0, MAX_RETURNED_LOGS);

  const loaded = await Promise.all(candidates.map(async blob => {
    try {
      const result = await get(blob.pathname, { access: "private" });
      if (!result?.stream || result.statusCode !== 200) return null;
      const text = await new Response(result.stream).text();
      if (text.length > 15_000) return null;
      const parsed: unknown = JSON.parse(text);
      if (!isLogEntry(parsed) || Date.parse(parsed.timestamp) < since) return null;
      return parsed;
    } catch {
      return null;
    }
  }));

  return {
    available: true,
    entries: loaded.filter((entry): entry is DiagnosticLogEntry => entry !== null)
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    truncated,
  };
}
