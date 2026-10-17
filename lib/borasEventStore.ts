import { get, put } from "@vercel/blob";

export type BrowserScrapedBorasEvent = {
  title: string;
  url: string;
  date: string;
  endDate?: string;
  time?: string;
  venue?: string;
  description?: string;
  image?: string;
};

export type BrowserScrapedBorasSnapshot = {
  savedAt: string;
  sourceUrl: string;
  events: BrowserScrapedBorasEvent[];
};

const BLOB_PATH = "glenn-news/boras-events/browser-scrape.json";
const MAX_BYTES = 1_500_000;
const MAX_AGE_MS = 72 * 60 * 60 * 1000;

export async function saveBrowserScrapedBorasEvents(events: BrowserScrapedBorasEvent[]) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN saknas.");
  const snapshot = {
    savedAt: new Date().toISOString(),
    sourceUrl: "https://www.boras.com/evenemang/",
    events,
  };
  await put(BLOB_PATH, JSON.stringify({ version: 1, ...snapshot }), {
    access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  });
  return snapshot;
}

export async function getBrowserScrapedBorasEvents(): Promise<BrowserScrapedBorasSnapshot | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await get(BLOB_PATH, { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    if (text.length > MAX_BYTES) return null;
    const value = JSON.parse(text) as { version?: unknown; savedAt?: unknown; sourceUrl?: unknown; events?: unknown };
    if (value.version !== 1 || typeof value.savedAt !== "string" ||
        typeof value.sourceUrl !== "string" || !Array.isArray(value.events) || value.events.length < 6) return null;
    const savedAt = Date.parse(value.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS || savedAt > Date.now() + 5 * 60 * 1000) return null;
    const events = value.events.filter((event): event is BrowserScrapedBorasEvent => {
      if (!event || typeof event !== "object") return false;
      const item = event as Record<string, unknown>;
      return typeof item.title === "string" && typeof item.url === "string" &&
        typeof item.date === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(item.date);
    });
    return events.length >= 6 ? { savedAt: value.savedAt, sourceUrl: value.sourceUrl, events } : null;
  } catch (error) {
    console.warn("Kunde inte läsa Borås webbläsarhämtade evenemang:", error);
    return null;
  }
}
