import { revalidateTag } from "next/cache";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import { getStockholmClock } from "@/lib/updateSchedule";
import {
  FOTBOLLSKANALEN_BROWSER_SOURCES,
  saveBrowserScrapedFotbollskanalenArticles,
  type BrowserScrapedFotbollskanalenArticle,
} from "@/lib/fotbollskanalenArticleStore";

export const dynamic = "force-dynamic";

const ALLOWED_SOURCE_URLS = new Set<string>(
  FOTBOLLSKANALEN_BROWSER_SOURCES.map(source => source.url)
);
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function safeImage(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  if (!(await authorizeGitHubActionsRefresh(request, "fotbollskanalenArticles"))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const clock = getStockholmClock();
  if (clock.hour < 1 || clock.hour >= 6) {
    return Response.json({
      ok: false,
      skipped: true,
      error: "Nightly write window is 01:00–05:59 Europe/Stockholm; late ingestion is rejected",
    }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 3_000_000) {
    return Response.json({ ok: false, error: "Fotbollskanalen payload too large" }, { status: 413 });
  }

  let payload: { articles?: unknown };
  try {
    payload = await request.json() as { articles?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!Array.isArray(payload.articles) || payload.articles.length < 6 || payload.articles.length > 400) {
    return Response.json({ ok: false, error: "Expected between 6 and 400 Fotbollskanalen articles" }, { status: 422 });
  }

  const now = Date.now();
  const oldestAllowed = now - MAX_AGE_MS;
  const unique = new Map<string, BrowserScrapedFotbollskanalenArticle>();

  for (const raw of payload.articles) {
    if (!isRecord(raw) ||
        !validText(raw.title, 240) ||
        !validText(raw.url, 2_048) ||
        typeof raw.date !== "string" ||
        !Array.isArray(raw.sourcePages)) continue;

    let url: URL;
    try { url = new URL(raw.url); } catch { continue; }

    if (url.protocol !== "https:" ||
        !["www.fotbollskanalen.se", "fotbollskanalen.se"].includes(url.hostname.toLowerCase()) ||
        (!url.pathname.includes("/artiklar/") && !url.pathname.includes("/bloggar/"))) continue;

    const publishedAt = Date.parse(raw.date);
    if (!Number.isFinite(publishedAt) ||
        publishedAt < oldestAllowed ||
        (publishedAt > now + 5 * 60 * 1000 && raw.date.slice(0, 10) !== new Date().toISOString().slice(0, 10))) continue;

    const sourcePages = [...new Set(raw.sourcePages.filter(
      (page): page is string => typeof page === "string" && ALLOWED_SOURCE_URLS.has(page)
    ))];
    if (sourcePages.length === 0) continue;

    const hasElfsborgPage = sourcePages.includes("https://www.fotbollskanalen.se/lag/if-elfsborg-herr");
    const item: BrowserScrapedFotbollskanalenArticle = {
      title: raw.title.trim().slice(0, 240),
      url: url.toString(),
      date: new Date(publishedAt).toISOString(),
      description: typeof raw.description === "string" ? raw.description.trim().slice(0, 900) || undefined : undefined,
      image: safeImage(raw.image),
      category: hasElfsborgPage || raw.category === "elfsborg" ? "elfsborg" : "fotboll",
      articleType: ["krönika", "analys", "reportage", "intervju", "kommentar"].includes(String(raw.articleType))
        ? String(raw.articleType)
        : undefined,
      sourcePages,
    };

    const existing = unique.get(item.url);
    if (!existing) {
      unique.set(item.url, item);
    } else {
      unique.set(item.url, {
        ...existing,
        category: existing.category === "elfsborg" || item.category === "elfsborg" ? "elfsborg" : "fotboll",
        sourcePages: [...new Set([...existing.sourcePages, ...item.sourcePages])],
        description: existing.description || item.description,
        image: existing.image || item.image,
        articleType: existing.articleType || item.articleType,
      });
    }
  }

  const articles = [...unique.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  if (articles.length < 6) {
    return Response.json({
      ok: false,
      error: "Färre än sex giltiga Fotbollskanalen-artiklar efter validering; den sparade listan lämnades orörd.",
    }, { status: 422 });
  }

  try {
    const snapshot = await saveBrowserScrapedFotbollskanalenArticles(articles);
    revalidateTag("glenn-news-articles", { expire: 0 });
    revalidateTag("glenn-news-feed-health", { expire: 0 });
    return Response.json({
      ok: true,
      stored: snapshot.articles.length,
      savedAt: snapshot.savedAt,
      sourcePages: FOTBOLLSKANALEN_BROWSER_SOURCES.length,
    });
  } catch (error) {
    console.error("Fotbollskanalen browser article scrape could not be saved:", error);
    return Response.json({ ok: false, error: "Kunde inte spara Fotbollskanalen-artiklarna." }, { status: 500 });
  }
}
