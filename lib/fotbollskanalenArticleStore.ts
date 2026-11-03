import { get, put } from "@vercel/blob";

export type BrowserScrapedFotbollskanalenArticle = {
  title: string;
  url: string;
  date: string;
  description?: string;
  image?: string;
  category: "fotboll" | "elfsborg";
  articleType?: string;
  sourcePages: string[];
};

export type BrowserScrapedFotbollskanalenSnapshot = {
  savedAt: string;
  articles: BrowserScrapedFotbollskanalenArticle[];
};

export const FOTBOLLSKANALEN_BROWSER_SOURCES = [
  { url: "https://www.fotbollskanalen.se/", category: "fotboll" },
  { url: "https://www.fotbollskanalen.se/lag/if-elfsborg-herr", category: "elfsborg" },
  { url: "https://www.fotbollskanalen.se/skribent/olof-lundh", category: "fotboll" },
] as const;

const BLOB_PATH = "glenn-news/fotbollskanalen/browser-articles.json";
const MAX_BYTES = 3_000_000;
const MAX_AGE_MS = 36 * 60 * 60 * 1000;
const SOURCE_URLS = new Set<string>(FOTBOLLSKANALEN_BROWSER_SOURCES.map(source => source.url));

export async function saveBrowserScrapedFotbollskanalenArticles(
  articles: BrowserScrapedFotbollskanalenArticle[]
): Promise<BrowserScrapedFotbollskanalenSnapshot> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN saknas; Fotbollskanalen-artiklarna kunde inte sparas.");
  }

  const snapshot: BrowserScrapedFotbollskanalenSnapshot = {
    savedAt: new Date().toISOString(),
    articles,
  };

  await put(BLOB_PATH, JSON.stringify({ version: 1, ...snapshot }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  return snapshot;
}

export async function getBrowserScrapedFotbollskanalenArticles(): Promise<BrowserScrapedFotbollskanalenSnapshot | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const result = await get(BLOB_PATH, { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;

    const text = await new Response(result.stream).text();
    if (text.length > MAX_BYTES) return null;

    const value = JSON.parse(text) as {
      version?: unknown;
      savedAt?: unknown;
      articles?: unknown;
    };

    if (value.version !== 1 || typeof value.savedAt !== "string" ||
        !Array.isArray(value.articles) || value.articles.length < 6) return null;

    const savedAtMs = Date.parse(value.savedAt);
    if (!Number.isFinite(savedAtMs) || Date.now() - savedAtMs > MAX_AGE_MS ||
        savedAtMs > Date.now() + 5 * 60 * 1000) return null;

    const articles = value.articles.filter((raw): raw is BrowserScrapedFotbollskanalenArticle => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
      const item = raw as Record<string, unknown>;
      let url: URL;
      try { url = new URL(String(item.url ?? "")); } catch { return false; }

      return typeof item.title === "string" &&
        item.title.trim().length > 0 &&
        item.title.length <= 240 &&
        url.protocol === "https:" &&
        ["www.fotbollskanalen.se", "fotbollskanalen.se"].includes(url.hostname.toLowerCase()) &&
        (/\/artiklar\//.test(url.pathname) || /\/bloggar\//.test(url.pathname)) &&
        typeof item.date === "string" &&
        Number.isFinite(Date.parse(item.date)) &&
        (item.category === "fotboll" || item.category === "elfsborg") &&
        Array.isArray(item.sourcePages) &&
        item.sourcePages.some(page => typeof page === "string" && SOURCE_URLS.has(page));
    });

    if (articles.length < 6) return null;
    return { savedAt: value.savedAt, articles };
  } catch (error) {
    console.warn("Kunde inte läsa den webbläsarhämtade Fotbollskanalen-listan:", error);
    return null;
  }
}
