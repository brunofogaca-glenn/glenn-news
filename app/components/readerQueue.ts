"use client";

/**
 * Per-tab reading queue: clicks are kept in sessionStorage until the user saves a batch.
 * Do not add a network request or Blob write here; the save button posts bounded batches
 * and nightly maintenance performs aggregation and profile updates.
 */
export type PendingReaderEvent = { eventId: string; timestamp: string; category: string; articleType: string; source: string; topic?: string; title?: string; summary?: string; link: string };
export type ReaderQueueState = { events: PendingReaderEvent[]; batchId?: string };
export const READER_QUEUE_KEY = "glenn-news-reading-queue-v1";
export const READER_QUEUE_EVENT = "glenn-reader-queue-updated";
export function readReaderQueue(): ReaderQueueState {
  try {
    const value = JSON.parse(sessionStorage.getItem(READER_QUEUE_KEY) ?? "null") as ReaderQueueState | null;
    if (value && Array.isArray(value.events)) return value;
  } catch {}
  return { events: [] };
}
export function enqueueReaderEvent(event: PendingReaderEvent) {
  const queue = readReaderQueue();
  queue.events.push(event);
  sessionStorage.setItem(READER_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(READER_QUEUE_EVENT));
}
