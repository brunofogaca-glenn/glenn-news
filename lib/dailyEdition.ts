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

async function buildDailyEdition(
  dateKey: string,
  profile: ReaderProfile
): Promise<DailyEdition> {
  const news = await getCachedArticles();

  const articleBuckets = {
    ...news,
    sport: [
      ...news.fotboll,
      ...news.sport,
      ...news.tennis,
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
            news.fotboll,
            [...news.sport, ...news.tennis],
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

  const edition = await buildDailyEdition(dateKey, profile);
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
