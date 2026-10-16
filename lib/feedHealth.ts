import { FEEDS, parseFeed } from "./rss";
import { WEB_SOURCES, fetchWebSource } from "./webSources";
import { canRefreshEditorialSourcesNow } from "./updateSchedule";

export type FeedHealth = {
  kind: "RSS" | "Webb";
  name: string;
  url: string;
  category: string;
  status: "ok" | "empty" | "stale" | "error";
  responseMs: number;
  articles24h: number;
  latestArticleAt: string | null;
  latestArticleAgeHours: number | null;
  detail: string;
};

function sourceNameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function countLast24Hours(items: Array<{ pubDate?: string; date?: string }>) {
  const since = Date.now() - 24 * 60 * 60 * 1000;

  return items.filter(item => {
    const raw = item.pubDate ?? item.date ?? "";
    const time = new Date(raw).getTime();
    return !isNaN(time) && time > since;
  }).length;
}

const STALE_AFTER_HOURS = 72;

function getLatestArticleTimestamp(
  items: Array<{ pubDate?: string; date?: string }>
) {
  const now = Date.now();
  const timestamps = items
    .map(item => new Date(item.pubDate ?? item.date ?? "").getTime())
    .filter(time => Number.isFinite(time) && time <= now + 5 * 60 * 1000);

  return timestamps.length ? Math.max(...timestamps) : null;
}

function getArticleAgeHours(timestamp: number | null) {
  if (timestamp === null) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / (60 * 60 * 1000)));
}

function getFeedHealthStatus(
  articles24h: number,
  latestArticleAgeHours: number | null
): "ok" | "empty" | "stale" {
  if (articles24h > 0) return "ok";
  if (
    latestArticleAgeHours !== null &&
    latestArticleAgeHours >= STALE_AFTER_HOURS
  ) {
    return "stale";
  }
  return "empty";
}

function getFreshnessDetail(
  itemCount: number,
  articles24h: number,
  latestArticleAgeHours: number | null
) {
  if (articles24h > 0) {
    return `${articles24h} artiklar senaste 24 h`;
  }

  if (latestArticleAgeHours === null) {
    return itemCount === 0
      ? "Flödet svarade men innehåller inga artiklar"
      : `${itemCount} poster hittades, men publiceringsdatum saknas eller kan inte tolkas`;
  }

  if (latestArticleAgeHours >= STALE_AFTER_HOURS) {
    return `Senaste daterade artikel är ${latestArticleAgeHours} h gammal; ingen ny artikel på minst ${STALE_AFTER_HOURS} h`;
  }

  return `${itemCount} poster i flödet; senaste daterade artikel för ${latestArticleAgeHours} h sedan, inga senaste 24 h`;
}

async function checkRssFeed(feed: (typeof FEEDS)[number]): Promise<FeedHealth> {
  const started = Date.now();

  try {
    const parsed = await parseFeed(feed.url);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const articles24h = countLast24Hours(items);
    const latestArticleTimestamp = getLatestArticleTimestamp(items);
    const latestArticleAt = latestArticleTimestamp === null
      ? null
      : new Date(latestArticleTimestamp).toISOString();
    const latestArticleAgeHours = getArticleAgeHours(latestArticleTimestamp);
    const status = getFeedHealthStatus(articles24h, latestArticleAgeHours);

    return {
      kind: "RSS",
      name: parsed.title?.trim() || sourceNameFromUrl(feed.url),
      url: feed.url,
      category: feed.category,
      status,
      responseMs: Date.now() - started,
      articles24h,
      latestArticleAt,
      latestArticleAgeHours,
      detail: getFreshnessDetail(items.length, articles24h, latestArticleAgeHours),
    };
  } catch (error) {
    return {
      kind: "RSS",
      name: sourceNameFromUrl(feed.url),
      url: feed.url,
      category: feed.category,
      status: "error",
      responseMs: Date.now() - started,
      articles24h: 0,
      latestArticleAt: null,
      latestArticleAgeHours: null,
      detail: error instanceof Error ? error.message : "Okänt fel",
    };
  }
}

async function checkWebSource(source: (typeof WEB_SOURCES)[number]): Promise<FeedHealth> {
  const started = Date.now();

  try {
    const articles = await fetchWebSource(source);
    const articles24h = countLast24Hours(articles);
    const latestArticleTimestamp = getLatestArticleTimestamp(articles);
    const latestArticleAt = latestArticleTimestamp === null
      ? null
      : new Date(latestArticleTimestamp).toISOString();
    const latestArticleAgeHours = getArticleAgeHours(latestArticleTimestamp);
    const status = getFeedHealthStatus(articles24h, latestArticleAgeHours);

    return {
      kind: "Webb",
      name: source.source,
      url: source.url,
      category: source.category,
      status,
      responseMs: Date.now() - started,
      articles24h,
      latestArticleAt,
      latestArticleAgeHours,
      detail: getFreshnessDetail(articles.length, articles24h, latestArticleAgeHours),
    };
  } catch (error) {
    return {
      kind: "Webb",
      name: source.source,
      url: source.url,
      category: source.category,
      status: "error",
      responseMs: Date.now() - started,
      articles24h: 0,
      latestArticleAt: null,
      latestArticleAgeHours: null,
      detail: error instanceof Error ? error.message : "Okänt fel",
    };
  }
}

export async function getFeedHealth() {
  if (!canRefreshEditorialSourcesNow()) {
    throw new Error("Kontroll av artikelkällor är spärrad före 06.00 Europe/Stockholm.");
  }

  const [rss, web] = await Promise.all([
    Promise.all(FEEDS.map(checkRssFeed)),
    Promise.all(WEB_SOURCES.map(checkWebSource)),
  ]);

  const feeds = [...rss, ...web];
  const healthy = feeds.filter(feed => feed.status === "ok").length;
  const empty = feeds.filter(feed => feed.status === "empty").length;
  const stale = feeds.filter(feed => feed.status === "stale").length;
  const errors = feeds.filter(feed => feed.status === "error").length;

  return {
    checkedAt: new Date().toISOString(),
    feeds,
    totals: {
      all: feeds.length,
      healthy,
      empty,
      stale,
      errors,
    },
  };
}
