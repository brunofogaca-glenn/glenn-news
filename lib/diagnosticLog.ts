import { createHash } from "node:crypto";

export type DiagnosticLevel = "error" | "warning";
export type DiagnosticLogEntry = {
  id: string; timestamp: string; level: DiagnosticLevel; component: string;
  message: string; detail?: string; stack?: string;
  context: Record<string, string | number | boolean | null>; fingerprint: string;
};

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

/**
 * Diagnostics go to Vercel Runtime Logs instead of Blob. This avoids one
 * persistent Blob write per incident. Deduplication is best-effort per warm
 * server instance, and messages/context are redacted before being logged.
 */
export async function recordDiagnostic(input: {
  level: DiagnosticLevel; component: string; message: string;
  error?: unknown;
  context?: Record<string, string | number | boolean | null>;
}) {
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

  const payload = {
    timestamp: new Date(now).toISOString(),
    level: input.level,
    component,
    message,
    ...(detail ? { detail } : {}),
    ...(stack ? { stack } : {}),
    context,
  };
  const serialized = JSON.stringify(payload);
  if (input.level === "error") console.error("[Glenn News diagnostic]", serialized);
  else console.warn("[Glenn News diagnostic]", serialized);
  return true;
}

/** Persistent diagnostic history is disabled to keep Blob operations within budget. */
export async function getDiagnosticEvents(_days = 1): Promise<{
  available: boolean; entries: DiagnosticLogEntry[]; truncated: boolean; message?: string;
}> {
  return {
    available: false,
    entries: [],
    truncated: false,
    message: "Beständig felloggning är avstängd för att minska Blob-operationer. Se Vercel Runtime Logs för diagnostik.",
  };
}
