"use client";

export type PendingReaderEvent = {
  eventId: string; timestamp: string; category: string; articleType: string; source: string;
  topic?: string; title?: string; summary?: string; link: string;
};
export type ReaderQueueState = { events: PendingReaderEvent[]; batchId?: string };
export const READER_QUEUE_KEY = "glenn-news-reading-queue-v1";
export const READER_QUEUE_EVENT = "glenn-reader-queue-updated";
export const MAX_READER_BATCH_SIZE = 50;

function requiredText(value: unknown, max: number, field: string): string {
  if (typeof value !== "string") throw new Error("Läsningen saknar giltig " + field + ".");
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, max).trim();
  if (!normalized) throw new Error("Läsningen saknar giltig " + field + ".");
  return normalized;
}
function optionalText(value: unknown, max: number, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error("Läsningen innehåller ogiltig " + field + ".");
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return normalized || undefined;
}
export function normalizePendingReaderEvent(event: PendingReaderEvent): PendingReaderEvent {
  if (!event || typeof event !== "object") throw new Error("Läshändelsen är ogiltig.");
  if (typeof event.eventId !== "string" || !/^[0-9]{13}-[a-f0-9]{32}$/i.test(event.eventId)) {
    throw new Error("Läshändelsen saknar giltigt händelse-ID.");
  }
  const eventIdTime = Number(event.eventId.slice(0, 13));
  const timestamp = typeof event.timestamp === "string" ? Date.parse(event.timestamp) : NaN;
  const oldestAllowed = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(eventIdTime) || eventIdTime > Date.now() + 60_000 || eventIdTime < oldestAllowed ||
      !Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || timestamp < oldestAllowed) {
    throw new Error("Läshändelsen har ett ogiltigt datum.");
  }
  if (typeof event.link !== "string" || event.link.length > 2048 || /\s/.test(event.link)) {
    throw new Error("Läshändelsen har en ogiltig artikellänk.");
  }
  let url: URL;
  try { url = new URL(event.link); } catch { throw new Error("Läshändelsen har en ogiltig artikellänk."); }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname || url.toString().length > 2048) {
    throw new Error("Läshändelsen har en ogiltig artikellänk.");
  }
  return {
    eventId: event.eventId, timestamp: new Date(timestamp).toISOString(),
    category: requiredText(event.category, 80, "kategori"),
    articleType: requiredText(event.articleType, 100, "artikeltyp"),
    source: requiredText(event.source, 160, "källa"),
    topic: optionalText(event.topic, 160, "ämne"),
    title: optionalText(event.title, 300, "rubrik"),
    summary: optionalText(event.summary, 1500, "sammanfattning"),
    link: url.toString(),
  };
}
export function readReaderQueue(): ReaderQueueState {
  try {
    const value = JSON.parse(sessionStorage.getItem(READER_QUEUE_KEY) ?? "null") as ReaderQueueState | null;
    if (value && Array.isArray(value.events)) return value;
  } catch {}
  return { events: [] };
}
export function enqueueReaderEvent(event: PendingReaderEvent) {
  const queue = readReaderQueue();
  // New clicks cannot be appended to an already-attempted batch: the server may
  // have stored/processed that ID even when the browser did not receive its reply.
  // A fresh ID lets the next upload carry these new events without being skipped
  // by the nightly ledger's processedBatchPaths idempotency check.
  if (queue.batchId) delete queue.batchId;
  queue.events.push(normalizePendingReaderEvent(event));
  sessionStorage.setItem(READER_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(READER_QUEUE_EVENT));
}
