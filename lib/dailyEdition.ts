import { get, list, put } from "@vercel/blob";
import {
  createEditorialSection,
  createSportEditorialSection,
  type EditorialSection,
} from "./editorV2";
import { getCachedArticles } from "./articlesCache";
import type { ReaderProfile } from "./readerProfile";

const TIME_ZONE = "Europe/Stockholm";
const EDITION_PREFIX = "glenn-news/editions/";

export type DailyEdition = {
  dateKey: string;
  generatedAt: string;
  totalArticles: number;
  sections: EditorialSection[];
  storage: "blob" | "live";
};

const EMPTY_PROFILE: ReaderProfile = {
  category: {},
  articleType: {},
  source: {},
  topic: {},
  totalClicks: 0,
  lastUpdated: null,
};

function getTodayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find(part => part.type === "year")?.value ?? "0000";
  const month = parts.find(part => part.type === "month")?.value ?? "00";
  const day = parts.find(part => part.type === "day")?.value ?? "00";

  return year + "-" + month + "-" + day;
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function editionPath(dateKey: string) {
  return EDITION_PREFIX + dateKey + ".json";
}

function normalizeArticleUrl(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.*|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return (url.hostname + url.pathname).replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, "");
  }
}

function normalizedTitle(value?: string) {
  return (value ?? "").trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function getEditionArticleKeys(edition: DailyEdition | null) {
  const keys = new Set<string>();
  if (!edition) return keys;

  for (const section of edition.sections ?? []) {
    const collect = (article: { link?: string; title?: string }) => {
      const urlKey = normalizeArticleUrl(article.link);
      const titleKey = normalizedTitle(article.title);
      if (urlKey) keys.add("url:" + urlKey);
      if (titleKey) keys.add("title:" + titleKey);
    };

    for (const story of section.stories ?? []) collect(story);
    for (const story of section.allArticles ?? []) collect(story);
  }

  return keys;
}

function filterPreviouslyPublished<T extends { link?: string; title?: string }>(
  articles: T[],
  previousKeys: Set<string>
) {
  return articles.filter(article => {
    const urlKey = normalizeArticleUrl(article.link);
    const titleKey = normalizedTitle(article.title);
    if (urlKey && previousKeys.has("url:" + urlKey)) return false;
    if (titleKey && previousKeys.has("title:" + titleKey)) return false;
    return true;
  });
}

async function buildDailyEdition(
  dateKey: string,
  profile: ReaderProfile,
  previousEdition: DailyEdition | null = null
): Promise<DailyEdition> {
  const news = await getCachedArticles();
  const previousKeys = getEditionArticleKeys(previousEdition);
  const filteredNews = Object.fromEntries(
    Object.entries(news).map(([category, articles]) => [
      category,
      filterPreviouslyPublished(articles as Array<{ link?: string; title?: string }>, previousKeys),
    ])
  ) as typeof news;

  const articleBuckets = {
    ...filteredNews,
    sport: [
      ...filteredNews.fotboll,
      ...filteredNews.sport,
      ...filteredNews.tennis,
    ],
  };

  const categoryConfig = [
    { key: "elfsborg", title: "Elfsborg" },
    { key: "boras", title: "Lokalt" },
    { key: "sverige", title: "Sverige" },
    { key: "varlden", title: "Världen" },
    { key: "ekonomi", title: "Ekonomi" },
    { key: "sport", title: "Sport" },
    { key: "livsstil", title: "Kultur, Mat & Livsstil" },
  ] as const;

  const sections = await Promise.all(
    categoryConfig.map(category =>
      category.key === "sport"
        ? createSportEditorialSection(
            filteredNews.fotboll,
            [...filteredNews.sport, ...filteredNews.tennis],
            profile
          )
        : createEditorialSection(
            category.key,
            category.title,
            articleBuckets[category.key],
            profile
          )
    )
  );

  const totalArticles = categoryConfig.reduce(
    (sum, category) => sum + articleBuckets[category.key].length,
    0
  );

  return {
    dateKey,
    generatedAt: new Date().toISOString(),
    totalArticles,
    sections,
    storage: "live",
  };
}

async function readBlobEdition(dateKey: string): Promise<DailyEdition | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !isValidDateKey(dateKey)) {
    return null;
  }

  try {
    const result = await get(editionPath(dateKey), {
      access: "private",
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text) as DailyEdition;

    if (
      parsed.dateKey !== dateKey ||
      !Array.isArray(parsed.sections)
    ) {
      return null;
    }

    return {
      ...parsed,
      storage: "blob",
    };
  } catch (error) {
    console.error("Kunde inte läsa sparad edition:", dateKey, error);
    return null;
  }
}

async function saveBlobEdition(edition: DailyEdition) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return false;
  }

  try {
    await put(
      editionPath(edition.dateKey),
      JSON.stringify(edition),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      }
    );

    return true;
  } catch (error) {
    console.error("Kunde inte spara edition:", edition.dateKey, error);
    return false;
  }
}

export async function getTodayDailyEdition(
  profile: ReaderProfile
): Promise<DailyEdition> {
  const dateKey = getTodayKey();

  const existing = await readBlobEdition(dateKey);
  if (existing) {
    return existing;
  }

  // Compare against the most recent saved morning edition before selecting today's stories.
  const previousDate = new Date(dateKey + "T12:00:00Z");
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const previousDateKey = previousDate.toISOString().slice(0, 10);
  const previousEdition = await readBlobEdition(previousDateKey);

  const edition = await buildDailyEdition(dateKey, profile, previousEdition);
  const saved = await saveBlobEdition(edition);

  return {
    ...edition,
    storage: saved ? "blob" : "live",
  };
}

export async function getSavedDailyEditions(limit = 7) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return [] as DailyEdition[];
  }

  try {
    const result = await list({
      prefix: EDITION_PREFIX,
      limit: Math.max(1, Math.min(limit * 2, 30)),
    });

    const paths = result.blobs
      .map(blob => blob.pathname)
      .map(pathname =>
        pathname.startsWith(EDITION_PREFIX)
          ? pathname.slice(EDITION_PREFIX.length)
          : ""
      )
      .map(path => path.replace(/\.json$/, ""))
      .filter(isValidDateKey)
      .sort()
      .reverse()
      .slice(0, limit);

    const editions = await Promise.all(
      paths.map(dateKey => readBlobEdition(dateKey))
    );

    return editions.filter(
      (edition): edition is DailyEdition => Boolean(edition)
    );
  } catch (error) {
    console.error("Kunde inte lista sparade editioner:", error);
    return [] as DailyEdition[];
  }
}

export async function createLiveDailyEdition(profile = EMPTY_PROFILE) {
  return buildDailyEdition(getTodayKey(), profile);
}
