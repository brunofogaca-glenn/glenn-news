import { FEEDS, parseFeed } from "./rss";
import { WEB_SOURCES, fetchWebSource } from "./webSources";

export type FeedHealth = {
  kind: "RSS" | "Webb";
  name: string;
  url: string;
  category: string;
  status: "ok" | "empty" | "error";
  responseMs: number;
  articles24h: number;
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

async function checkRssFeed(feed: (typeof FEEDS)[number]): Promise<FeedHealth> {
  const started = Date.now();

  try {
    const parsed = await parseFeed(feed.url);
    const articles24h = countLast24Hours(parsed.items);
    const status = articles24h > 0 ? "ok" : "empty";

    return {
      kind: "RSS",
      name: parsed.title?.trim() || sourceNameFromUrl(feed.url),
      url: feed.url,
      category: feed.category,
      status,
      responseMs: Date.now() - started,
      articles24h,
      detail:
        articles24h > 0
          ? `${articles24h} artiklar senaste 24 h`
          : "Flödet svarade, men inga artiklar senaste 24 h",
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
      detail: error instanceof Error ? error.message : "Okänt fel",
    };
  }
}

async function checkWebSource(source: (typeof WEB_SOURCES)[number]): Promise<FeedHealth> {
  const started = Date.now();

  try {
    const articles = await fetchWebSource(source);
    const articles24h = countLast24Hours(articles);
    const status = articles24h > 0 ? "ok" : "empty";

    return {
      kind: "Webb",
      name: source.source,
      url: source.url,
      category: source.category,
      status,
      responseMs: Date.now() - started,
      articles24h,
      detail:
        articles24h > 0
          ? `${articles24h} artiklar senaste 24 h`
          : `${articles.length} artiklar hittades, men inga med tydligt datum senaste 24 h`,
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
      detail: error instanceof Error ? error.message : "Okänt fel",
    };
  }
}

export async function getFeedHealth() {
  const [rss, web] = await Promise.all([
    Promise.all(FEEDS.map(checkRssFeed)),
    Promise.all(WEB_SOURCES.map(checkWebSource)),
  ]);

  const feeds = [...rss, ...web];
  const healthy = feeds.filter(feed => feed.status === "ok").length;
  const empty = feeds.filter(feed => feed.status === "empty").length;
  const errors = feeds.filter(feed => feed.status === "error").length;

  return {
    checkedAt: new Date().toISOString(),
    feeds,
    totals: {
      all: feeds.length,
      healthy,
      empty,
      errors,
    },
  };
}
