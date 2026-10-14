import { get, list, put } from "@vercel/blob";
import {
  createEditorialSection,
  createSportEditorialSection,
  enrichEditorialImages,
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

const EXPECTED_SECTION_TITLES: Record<string, string> = {
  elfsborg: "Elfsborg",
  boras: "Lokalt",
  sverige: "Sverige",
  varlden: "Världen",
  ekonomi: "Ekonomi",
  sport: "Sport",
  livsstil: "Kultur, Mat & Livsstil",
};

function isValidArticleLink(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 2_048) {
    return false;
  }

  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !/\\s/.test(value)
    );
  } catch {
    return false;
  }
}

/**
 * Validate the editorial payload before it can become the saved edition.
 * A small day is allowed, but a structurally incomplete or entirely empty
 * edition is not saved as if it were ready to read.
 */
function validateDailyEditionForSave(
  edition: DailyEdition,
  expectedDateKey: string
) {
  const errors: string[] = [];

  if (edition.dateKey !== expectedDateKey || !isValidDateKey(edition.dateKey)) {
    errors.push("dateKey is missing, invalid, or does not match the requested edition date");
  }

  if (
    typeof edition.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(edition.generatedAt))
  ) {
    errors.push("generatedAt is missing or is not a valid timestamp");
  }

  if (
    !Number.isInteger(edition.totalArticles) ||
    edition.totalArticles < 0
  ) {
    errors.push("totalArticles must be a non-negative integer");
  }

  if (!Array.isArray(edition.sections)) {
    errors.push("sections must be an array");
  } else {
    const keys = edition.sections.map(section => section?.key);
    const missingKeys = Object.keys(EXPECTED_SECTION_TITLES).filter(
      key => !keys.includes(key)
    );
    const unexpectedKeys = keys.filter(
      key => typeof key !== "string" || !(key in EXPECTED_SECTION_TITLES)
    );
    const duplicateKeys = keys.filter(
      (key, index) => keys.indexOf(key) !== index
    );

    if (edition.sections.length !== Object.keys(EXPECTED_SECTION_TITLES).length) {
      errors.push("the edition must contain all seven configured sections");
    }
    if (missingKeys.length) errors.push("missing sections: " + missingKeys.join(", "));
    if (unexpectedKeys.length) errors.push("unexpected section keys are present");
    if (duplicateKeys.length) errors.push("duplicate section keys: " + [...new Set(duplicateKeys)].join(", "));

    for (const section of edition.sections) {
      if (!section || typeof section !== "object") {
        errors.push("a section is not an object");
        continue;
      }

      if (section.title !== EXPECTED_SECTION_TITLES[section.key]) {
        errors.push("section title mismatch for " + String(section.key));
      }

      if (typeof section.summary !== "string") {
        errors.push("section summary is missing for " + String(section.key));
      }

      if (!Array.isArray(section.stories)) {
        errors.push("stories must be an array for " + String(section.key));
        continue;
      }

      section.stories.forEach((story, index) => {
        const prefix = String(section.key) + " story " + String(index + 1);

        if (!story || typeof story !== "object") {
          errors.push(prefix + " is not an object");
          return;
        }
        if (typeof story.title !== "string" || !story.title.trim()) {
          errors.push(prefix + " has no title");
        }
        if (!isValidArticleLink(story.link)) {
          errors.push(prefix + " has no valid HTTP(S) article URL");
        }
        if (typeof story.aiSummary !== "string") {
          errors.push(prefix + " has no valid aiSummary field");
        }
        if (typeof story.selectionReason !== "string") {
          errors.push(prefix + " has no valid selectionReason field");
        }
        if (typeof story.articleType !== "string" || !story.articleType.trim()) {
          errors.push(prefix + " has no article type");
        }
      });

      if (
        section.key === "elfsborg" &&
        section.allArticles !== undefined &&
        !Array.isArray(section.allArticles)
      ) {
        errors.push("Elfsborg allArticles must be an array when present");
      }
    }
  }

  const selectedStoryCount = Array.isArray(edition.sections)
    ? edition.sections.reduce(
        (sum, section) => sum + (Array.isArray(section?.stories) ? section.stories.length : 0),
        0
      )
    : 0;

  if (edition.totalArticles <= 0) {
    errors.push("the source pool contains no articles");
  }
  if (selectedStoryCount <= 0) {
    errors.push("no readable stories were selected");
  }

  if (errors.length) {
    console.error("Morning edition validation failed:", {
      dateKey: expectedDateKey,
      errors,
    });
    throw new Error(
      "Morgonens edition klarade inte kvalitetskontrollen: " + errors.join("; ")
    );
  }

  const emptySections = edition.sections
    .filter(section => section.stories.length === 0)
    .map(section => section.key);

  if (emptySections.length) {
    console.warn("Morning edition has sections with no selected stories:", {
      dateKey: expectedDateKey,
      sections: emptySections,
      note: "Empty categories are allowed when their source pool is genuinely thin.",
    });
  }
}

async function buildDailyEdition(
  dateKey: string,
  profile: ReaderProfile,
  previousEdition: DailyEdition | null = null,
  suppliedNews?: Awaited<ReturnType<typeof getCachedArticles>>
): Promise<DailyEdition> {
  const news = suppliedNews ?? await getCachedArticles();
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

  const editorialSections = await Promise.all(
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
  const sections = await enrichEditorialImages(editorialSections);

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

async function getPreviousEditionKeys(dateKey: string, days = 7) {
  const keys = new Set<string>();
  const date = new Date(dateKey + "T12:00:00Z");

  for (let offset = 1; offset <= days; offset += 1) {
    const previousDate = new Date(date);
    previousDate.setUTCDate(previousDate.getUTCDate() - offset);
    const previousDateKey = previousDate.toISOString().slice(0, 10);
    const edition = await readBlobEdition(previousDateKey);

    for (const key of getEditionArticleKeys(edition)) {
      keys.add(key);
    }
  }

  return keys;
}

function editionHasPreviouslyPublishedArticles(
  edition: DailyEdition,
  previousKeys: Set<string>
) {
  for (const key of getEditionArticleKeys(edition)) {
    if (previousKeys.has(key)) return true;
  }

  return false;
}

function createWaitingEdition(dateKey: string): DailyEdition {
  const sections: EditorialSection[] = [
    { key: "elfsborg", title: "Elfsborg", summary: "Morgoneditionen är inte tillgänglig ännu. Försök ladda om sidan om en stund.", stories: [], allArticles: [] },
    { key: "boras", title: "Lokalt", summary: "Morgoneditionen är inte tillgänglig ännu. Försök ladda om sidan om en stund.", stories: [] },
    { key: "sverige", title: "Sverige", summary: "Morgoneditionen är inte tillgänglig ännu. Försök ladda om sidan om en stund.", stories: [] },
    { key: "varlden", title: "Världen", summary: "Morgoneditionen är inte tillgänglig ännu. Försök ladda om sidan om en stund.", stories: [] },
    { key: "ekonomi", title: "Ekonomi", summary: "Morgoneditionen är inte tillgänglig ännu. Försök ladda om sidan om en stund.", stories: [] },
    { key: "sport", title: "Sport", summary: "Morgoneditionen är inte tillgänglig ännu. Försök ladda om sidan om en stund.", stories: [] },
    { key: "livsstil", title: "Kultur, Mat & Livsstil", summary: "Morgoneditionen är inte tillgänglig ännu. Försök ladda om sidan om en stund.", stories: [] },
  ];

  return {
    dateKey,
    generatedAt: new Date().toISOString(),
    totalArticles: 0,
    sections,
    storage: "live",
  };
}

/**
 * Prefer the scheduled, saved edition. If the cron did not run or failed,
 * generate and persist the edition on the first homepage request instead of
 * showing an empty "not available" page. generateMorningEdition is idempotent
 * once the saved edition exists.
 */
export async function getTodayDailyEdition(
  profile: ReaderProfile
): Promise<DailyEdition> {
  const dateKey = getTodayKey();
  const existing = await readBlobEdition(dateKey);
  if (existing) return existing;

  return generateMorningEdition(profile);
}

/**
 * Called by the scheduled 06:30 Stockholm cron only.
 * A successful saved edition makes subsequent/retried invocations idempotent.
 */
export async function generateMorningEdition(
  profile: ReaderProfile
): Promise<DailyEdition> {
  const dateKey = getTodayKey();
  const existing = await readBlobEdition(dateKey);
  const previousKeys = await getPreviousEditionKeys(dateKey);
  const existingIsFreshEnough = existing
    ? (() => {
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: TIME_ZONE,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date(existing.generatedAt));
        const hour = Number(parts.find(part => part.type === "hour")?.value ?? "0");
        const minute = Number(parts.find(part => part.type === "minute")?.value ?? "0");
        return hour > 6 || (hour === 6 && minute >= 30);
      })()
    : false;

  if (
    existing &&
    existingIsFreshEnough &&
    !editionHasPreviouslyPublishedArticles(existing, previousKeys)
  ) {
    return existing;
  }

  // Force fresh source data after the cron has invalidated the RSS cache.
  const news = await getCachedArticles();
  const filteredNews = Object.fromEntries(
    Object.entries(news).map(([category, articles]) => [
      category,
      filterPreviouslyPublished(
        articles as Array<{ link?: string; title?: string }>,
        previousKeys
      ),
    ])
  ) as typeof news;

  const edition = await buildDailyEdition(dateKey, profile, null, filteredNews);
  validateDailyEditionForSave(edition, dateKey);

  const saved = await saveBlobEdition(edition);

  if (!saved) {
    throw new Error("Morgonens edition kunde inte sparas i Vercel Blob.");
  }

  return { ...edition, storage: "blob" };
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
