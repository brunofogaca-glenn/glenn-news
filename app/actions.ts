"use server";

import { revalidateTag } from "next/cache";
import { getCachedArticles } from "@/lib/articlesCache";
import { addWeeklyReadLink } from "@/lib/weeklyRead";
import { getCachedSportDay } from "@/lib/sportDayCache";
import { getCachedMarketDay } from "@/lib/marketDay";
import { getCachedFeedHealth } from "@/lib/feedHealthCache";
import { getReaderProfile } from "@/lib/readerProfile";
import { generateMorningEdition } from "@/lib/dailyEdition";
import {
  getCachedLocalSnapshot,
  getCachedNationalSnapshot,
  getCachedCultureSnapshot,
  getCachedWorldSnapshot,
} from "@/lib/dailySnapshots";
import { getCachedWeather } from "@/lib/weather";
import { getDailyHeaderInfo } from "@/lib/dailyHeader";

/**
 * Refresh the underlying source data used by optional homepage panels.
 * This deliberately does not regenerate today's saved morning edition.
 */
export async function refreshNews() {
  const tags = [
    "glenn-news-articles",
    "glenn-news-feed-health",
    "glenn-news-sport-day",
    "glenn-news-market-day",
    "glenn-news-daily-local",
    "glenn-news-daily-national",
    "glenn-news-daily-culture",
    "glenn-news-daily-world",
    "glenn-news-weather",
    "glenn-news-daily-header",
  ];
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }

  // Fetch all homepage source panels concurrently after invalidating their caches.
  // This refreshes supplemental data only; the saved morning edition stays unchanged.
  await Promise.all([
    getCachedArticles(),
    getCachedFeedHealth(),
    getCachedSportDay(),
    getCachedMarketDay(),
    getCachedLocalSnapshot(),
    getCachedNationalSnapshot(),
    getCachedCultureSnapshot(),
    getCachedWorldSnapshot(),
    getCachedWeather(),
    getDailyHeaderInfo(),
  ]);

  return {
    sourcesRefreshedAt: new Date().toISOString(),
    refreshedSources: [
      "nyhetsflöden", "flödesstatus", "sport", "marknad",
      "lokalt", "Sverige", "kultur", "världen", "väder", "namnsdag och historik",
    ],
    morningEditionChanged: false,
  };
}


/**
 * Explicitly retry the current day's edition after a homepage fallback.
 * Refresh the source cache first, then let the edition generator validate
 * and persist today's edition. The generator remains idempotent if today's
 * valid edition already exists.
 */
export async function retryMorningEdition() {
  revalidateTag("glenn-news-articles", { expire: 0 });
  await getCachedArticles();

  const profile = await getReaderProfile();
  const edition = await generateMorningEdition(profile);

  return {
    dateKey: edition.dateKey,
    generatedAt: edition.generatedAt,
    totalArticles: edition.totalArticles,
  };
}

export async function markWeeklyRead(link: string) {
  if (!link || !/^https?:\/\//i.test(link)) {
    throw new Error("Ogiltig artikel-länk");
  }

  await addWeeklyReadLink(link);
}
