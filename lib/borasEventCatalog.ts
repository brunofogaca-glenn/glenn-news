import type { BrowserScrapedBorasEvent } from "./borasEventStore";

export const BORAS_EVENT_HORIZON_DAYS = Number(process.env.BORAS_EVENTS_HORIZON_DAYS ?? 180);
export const BORAS_EVENT_RETENTION_DAYS = 30;

if (!Number.isInteger(BORAS_EVENT_HORIZON_DAYS) ||
    BORAS_EVENT_HORIZON_DAYS < 60 || BORAS_EVENT_HORIZON_DAYS > 365) {
  throw new Error("BORAS_EVENTS_HORIZON_DAYS must be an integer from 60 to 365");
}

export type BorasEventCatalogMerge = {
  events: BrowserScrapedBorasEvent[];
  contentChanged: boolean;
  complete: boolean;
  reason?: string;
};

function stockholmDateKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  return `${parts.find(part => part.type === "year")?.value ?? "2000"}-${parts.find(part => part.type === "month")?.value ?? "01"}-${parts.find(part => part.type === "day")?.value ?? "01"}`;
}

export function addCalendarDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeBorasEventUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["www.boras.com", "boras.com"].includes(url.hostname.toLowerCase()) ||
      url.port ||
      url.username ||
      url.password ||
      !/^\/evenemang\/[^/?#]+\/?$/.test(url.pathname)
    ) return null;
    url.hostname = "www.boras.com";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isUsableBorasEvent(
  event: BrowserScrapedBorasEvent,
  today: string,
  horizonDays = BORAS_EVENT_HORIZON_DAYS
) {
  const finalDate = event.endDate ?? event.date;
  return isDate(event.date) &&
    (!event.endDate || (isDate(event.endDate) && event.endDate >= event.date)) &&
    Boolean(normalizeBorasEventUrl(event.url)) &&
    event.date <= addCalendarDays(today, horizonDays) &&
    finalDate >= addCalendarDays(today, -BORAS_EVENT_RETENTION_DAYS);
}

function normalizedEvent(event: BrowserScrapedBorasEvent): BrowserScrapedBorasEvent {
  return { ...event, url: normalizeBorasEventUrl(event.url) ?? event.url };
}

function contentFingerprint(events: BrowserScrapedBorasEvent[]) {
  return JSON.stringify(
    [...events].map(normalizedEvent).sort((a, b) => a.url.localeCompare(b.url))
  );
}

export function mergeBorasEventCatalog(
  existingEvents: BrowserScrapedBorasEvent[],
  incomingEvents: BrowserScrapedBorasEvent[],
  options: {
    today?: string;
    complete?: boolean;
    expectedMinimum?: number;
    previousCount?: number;
  } = {}
): BorasEventCatalogMerge {
  const today = options.today ?? stockholmDateKey();
  const expectedMinimum = options.expectedMinimum ?? 6;
  const validExisting = existingEvents.filter(event => isUsableBorasEvent(event, today));
  const previousCount = options.previousCount ?? validExisting.length;

  const uniqueIncoming = new Map<string, BrowserScrapedBorasEvent>();
  for (const event of incomingEvents) {
    if (!isUsableBorasEvent(event, today)) continue;
    const normalized = normalizedEvent(event);
    uniqueIncoming.set(normalized.url, normalized);
  }

  // Incomplete pagination, low counts, and sudden large drops must never
  // replace or prune the last known-good catalogue.
  if (
    options.complete !== true ||
    uniqueIncoming.size < expectedMinimum ||
    (previousCount >= expectedMinimum && uniqueIncoming.size <= Math.ceil(previousCount * 0.5))
  ) {
    const reason = options.complete !== true
      ? "Scrape was not marked complete"
      : uniqueIncoming.size < expectedMinimum
        ? "Too few validated events"
        : "Incoming scrape is substantially smaller than the previous catalogue";
    return { events: existingEvents, contentChanged: false, complete: false, reason };
  }

  const merged = new Map<string, BrowserScrapedBorasEvent>();
  for (const event of validExisting) {
    const normalized = normalizedEvent(event);
    merged.set(normalized.url, normalized);
  }
  // Upsert current source entries. Future events missing from this one complete
  // listing remain until their event/end date is outside the retention window.
  for (const [url, event] of uniqueIncoming) merged.set(url, event);

  const events = [...merged.values()].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
    a.url.localeCompare(b.url)
  );
  return {
    events,
    contentChanged: contentFingerprint(validExisting) !== contentFingerprint(events),
    complete: true,
  };
}
