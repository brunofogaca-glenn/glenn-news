import { get, put } from "@vercel/blob";
import {
  mergeBorasEventCatalog,
  normalizeBorasEventUrl,
} from "./borasEventCatalog";

export type BrowserScrapedBorasEvent = {
  title: string;
  url: string;
  date: string;
  endDate?: string;
  time?: string;
  venue?: string;
  description?: string;
  image?: string;
  status?: "active" | "unlisted" | "cancelled";
  missingCompleteScrapes?: number;
};

export type BrowserScrapedBorasSnapshot = {
  savedAt: string;
  checkedAt: string;
  contentUpdatedAt: string;
  sourceUrl: string;
  events: BrowserScrapedBorasEvent[];
  stale: boolean;
};

const BLOB_PATH = "glenn-news/boras-events/browser-scrape.json";
const MAX_BYTES = 1_500_000;
const STALE_AFTER_MS = 72 * 60 * 60 * 1000;
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const SOURCE_URL = "https://www.boras.com/evenemang/";

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function saveBrowserScrapedBorasEvents(
  incomingEvents: BrowserScrapedBorasEvent[],
  options: {
    complete?: boolean;
    expectedMinimum?: number;
    existingSnapshot?: BrowserScrapedBorasSnapshot | null;
  } = {}
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN saknas.");
  // The ingestion route has just re-read the fixed snapshot for idempotency.
  // Reuse that value instead of issuing a second Blob read for the same write.
  const current = options.existingSnapshot === undefined
    ? await getBrowserScrapedBorasEvents()
    : options.existingSnapshot;
  const merge = mergeBorasEventCatalog(current?.events ?? [], incomingEvents, {
    complete: options.complete === true,
    expectedMinimum: options.expectedMinimum ?? 6,
  });
  if (!merge.complete) {
    throw new Error(`Borås-katalogen lämnades orörd: ${merge.reason ?? "ofullständig hämtning"}.`);
  }

  const now = new Date().toISOString();
  const snapshot = {
    savedAt: now,
    checkedAt: now,
    contentUpdatedAt: merge.contentChanged
      ? now
      : current?.contentUpdatedAt ?? current?.savedAt ?? now,
    sourceUrl: SOURCE_URL,
    events: merge.events,
  };

  await put(BLOB_PATH, JSON.stringify({ version: 2, ...snapshot }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return { ...snapshot, contentChanged: merge.contentChanged };
}

export async function getBrowserScrapedBorasEvents(): Promise<BrowserScrapedBorasSnapshot | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await get(BLOB_PATH, { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    if (text.length > MAX_BYTES) return null;

    const value = JSON.parse(text) as {
      version?: unknown;
      savedAt?: unknown;
      checkedAt?: unknown;
      contentUpdatedAt?: unknown;
      sourceUrl?: unknown;
      events?: unknown;
    };
    if (
      (value.version !== 1 && value.version !== 2) ||
      typeof value.savedAt !== "string" ||
      typeof value.sourceUrl !== "string" ||
      !Array.isArray(value.events) ||
      value.events.length < 6
    ) return null;

    const savedAtMs = Date.parse(value.savedAt);
    if (
      !Number.isFinite(savedAtMs) ||
      Date.now() - savedAtMs > MAX_AGE_MS ||
      savedAtMs > Date.now() + 5 * 60 * 1000
    ) return null;

    const checkedAt = typeof value.checkedAt === "string" &&
      Number.isFinite(Date.parse(value.checkedAt))
      ? value.checkedAt
      : value.savedAt;
    const contentUpdatedAt = typeof value.contentUpdatedAt === "string" &&
      Number.isFinite(Date.parse(value.contentUpdatedAt))
      ? value.contentUpdatedAt
      : value.savedAt;
    const checkedAtMs = Date.parse(checkedAt);
    if (!Number.isFinite(checkedAtMs) || checkedAtMs > Date.now() + 5 * 60 * 1000) return null;

    const events = value.events.filter((event): event is BrowserScrapedBorasEvent => {
      if (!event || typeof event !== "object" || Array.isArray(event)) return false;
      const item = event as Record<string, unknown>;
      return typeof item.title === "string" &&
        item.title.trim().length > 0 &&
        item.title.length <= 260 &&
        typeof item.url === "string" &&
        Boolean(normalizeBorasEventUrl(item.url)) &&
        isValidDate(item.date) &&
        (item.endDate === undefined || isValidDate(item.endDate));
    }).map(event => {
      const item = event as BrowserScrapedBorasEvent;
      const status: BrowserScrapedBorasEvent["status"] =
        item.status === "cancelled" || item.status === "unlisted" ? item.status : "active";
      return {
        ...item,
        url: normalizeBorasEventUrl(item.url)!,
        status,
        missingCompleteScrapes: Number.isSafeInteger(item.missingCompleteScrapes)
          ? Math.max(0, Math.min(100, item.missingCompleteScrapes ?? 0))
          : 0,
      };
    });

    if (events.length < 6) return null;
    return {
      savedAt: value.savedAt,
      checkedAt,
      contentUpdatedAt,
      sourceUrl: SOURCE_URL,
      events,
      // Keep last-good data readable for up to a year, but don't describe it as fresh.
      stale: Date.now() - checkedAtMs > STALE_AFTER_MS,
    };
  } catch (error) {
    console.warn("Kunde inte läsa Borås webbläsarhämtade evenemang:", error);
    return null;
  }
}
