import { NextResponse } from "next/server";
import { recordReaderBatch, type BatchedReaderEvent } from "@/lib/readerProfile";

export const maxDuration = 60;
const MAX_BATCH_BYTES = 180_000;
const MAX_BATCH_EVENTS = 50;
type BatchErrorCode = "payload_too_large" | "invalid_batch" | "invalid_event" | "storage_unavailable" | "internal_error";

function failure(code: BatchErrorCode, message: string, status: number, details?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: { code, message, ...details } }, { status });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return normalized || null;
}
function isArticleUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048 || value.trim() !== value || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname) && url.toString().length <= 2048;
  } catch { return false; }
}
function isEventId(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{13}-[a-f0-9]{32}$/i.test(value)) return false;
  const timestamp = Number(value.slice(0, 13));
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 60_000 && timestamp >= Date.now() - 30 * 24 * 60 * 60 * 1000;
}
function normalizeEvent(value: unknown): { event: BatchedReaderEvent } | { field: string } {
  if (!isRecord(value)) return { field: "event" };
  if (!isEventId(value.eventId)) return { field: "eventId" };
  const timestamp = typeof value.timestamp === "string" ? Date.parse(value.timestamp) : NaN;
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || timestamp < Date.now() - 30 * 24 * 60 * 60 * 1000) return { field: "timestamp" };
  if (typeof value.category !== "string" || !normalizeText(value.category, 80)) return { field: "category" };
  if (typeof value.articleType !== "string" || !normalizeText(value.articleType, 100)) return { field: "articleType" };
  if (typeof value.source !== "string" || !normalizeText(value.source, 160)) return { field: "source" };
  if (!isArticleUrl(value.link)) return { field: "link" };
  const optional: Record<string, string | undefined> = {};
  for (const [field, max] of [["topic", 160], ["title", 300], ["summary", 1500]] as const) {
    if (value[field] !== undefined && value[field] !== null) {
      if (typeof value[field] !== "string") return { field };
      optional[field] = normalizeText(value[field], max) ?? undefined;
    }
  }
  return { event: {
    eventId: value.eventId, timestamp: new Date(timestamp).toISOString(),
    category: normalizeText(value.category, 80)!, articleType: normalizeText(value.articleType, 100)!,
    source: normalizeText(value.source, 160)!, topic: optional.topic, title: optional.title,
    summary: optional.summary, link: value.link,
  }};
}
async function readLimitedBody(request: Request): Promise<{ text: string } | { tooLarge: true } | { invalid: true }> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BATCH_BYTES) return { tooLarge: true };
  if (!request.body) return { invalid: true };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BATCH_BYTES) { await reader.cancel(); return { tooLarge: true }; }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    return { text };
  } catch { return { invalid: true }; }
  finally { reader.releaseLock(); }
}
export async function POST(request: Request) {
  try {
    const bodyResult = await readLimitedBody(request);
    if ("tooLarge" in bodyResult) return failure("payload_too_large", "Läsbatchen är för stor. Artiklarna ligger kvar i kön; spara en mindre omgång.", 413, { maxBytes: MAX_BATCH_BYTES });
    if ("invalid" in bodyResult) return failure("invalid_batch", "Begäran kunde inte läsas. Artiklarna ligger kvar i kön.", 400);
    let body: unknown;
    try { body = JSON.parse(bodyResult.text); }
    catch { return failure("invalid_batch", "Begäran innehöll inte giltig JSON. Artiklarna ligger kvar i kön.", 400); }
    if (!isRecord(body)) return failure("invalid_batch", "Batchen har ett ogiltigt format. Artiklarna ligger kvar i kön.", 400);
    if (typeof body.batchId !== "string" || !/^[0-9]{13}-[a-f0-9]{32}$/i.test(body.batchId)) {
      return failure("invalid_batch", "Batchens identitet är ogiltig. Artiklarna ligger kvar i kön.", 400, { field: "batchId" });
    }
    if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > MAX_BATCH_EVENTS) {
      return failure("invalid_batch", "En sparning måste innehålla mellan 1 och 50 artiklar. Artiklarna ligger kvar i kön.", 400, { field: "events", maxEvents: MAX_BATCH_EVENTS });
    }
    const events: BatchedReaderEvent[] = [];
    for (let index = 0; index < body.events.length; index += 1) {
      const normalized = normalizeEvent(body.events[index]);
      if ("field" in normalized) {
        const labels: Record<string, string> = {
          event: "artikeln", eventId: "händelse-ID", timestamp: "datum", category: "kategori",
          articleType: "artikeltyp", source: "källa", topic: "ämne", title: "rubrik",
          summary: "sammanfattning", link: "artikellänk",
        };
        return failure("invalid_event", "Minst en artikel innehåller ogiltiga uppgifter. Inget har sparats; alla artiklar ligger kvar i kön.", 400,
          { eventIndex: index, field: normalized.field, fieldLabel: labels[normalized.field] ?? "metadata" });
      }
      events.push(normalized.event);
    }
    // One private write per batch; the fixed batch ID makes retries overwrite the same object.
    const saved = await recordReaderBatch(body.batchId, events);
    return saved
      ? NextResponse.json({ ok: true, saved: events.length, queuedForNightlyProcessing: true })
      : failure("storage_unavailable", "Läshistoriken kunde inte sparas centralt just nu. Alla artiklar ligger kvar i din kö.", 503);
  } catch (error) {
    console.error("Reader batch failed:", error);
    return failure("internal_error", "Ett tekniskt fel hindrade sparandet. Alla artiklar ligger kvar i kön – försök igen senare.", 500);
  }
}
