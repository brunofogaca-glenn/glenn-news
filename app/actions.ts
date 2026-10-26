"use server";

import { revalidateTag } from "next/cache";
import { getCachedArticles } from "@/lib/articlesCache";
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
import { canRefreshEditorialSourcesNow, getStockholmClock } from "@/lib/updateSchedule";

/**
 * Refresh the underlying source data used by optional homepage panels.
 * This deliberately does not regenerate today's saved morning edition.
 */
export async function refreshNews() {
  if (getStockholmClock().hour >= 6) {
    throw new Error("Manuella källuppdateringar är stängda efter 06.00. Glenn News uppdateras nattetid.");
  }
  const editorialSourcesAllowed = canRefreshEditorialSourcesNow();
  const supplementalTags = [
    "glenn-news-sport-day",
    "glenn-news-market-day",
    "glenn-news-daily-local",
    "glenn-news-daily-national",
    "glenn-news-daily-culture",
    "glenn-news-daily-world",
    "glenn-news-weather",
    "glenn-news-daily-header",
  ];
  const tags = editorialSourcesAllowed
    ? ["glenn-news-articles", "glenn-news-feed-health", ...supplementalTags]
    : supplementalTags;

  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }

  // Before 06:00, refresh supplemental panels only. Feed-health checks also
  // fetch editorial RSS, so they must follow the same publication window.
  await Promise.all([
    getCachedSportDay(),
    getCachedMarketDay(),
    getCachedLocalSnapshot(),
    getCachedNationalSnapshot(),
    getCachedCultureSnapshot(),
    getCachedWorldSnapshot(),
    getCachedWeather(),
    getDailyHeaderInfo(),
    ...(editorialSourcesAllowed ? [getCachedArticles(), getCachedFeedHealth()] : []),
  ]);

  return {
    sourcesRefreshedAt: new Date().toISOString(),
    refreshedSources: [
      ...(editorialSourcesAllowed ? ["nyhetsflöden", "flödesstatus"] : []),
      "sport", "marknad", "lokalt", "Sverige", "kultur", "världen", "väder", "namnsdag och historik",
    ],
    editorialRefreshDeferred: !editorialSourcesAllowed,
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
  const clock = getStockholmClock();
  if (clock.hour !== 6) {
    throw new Error("Återförsök av morgonutgåvan tillåts bara mellan 06.00 och 06.59 svensk tid.");
  }
  if (!canRefreshEditorialSourcesNow()) {
    throw new Error("Morgonutgåvan kan inte återskapas före 06.00 svensk tid.");
  }

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
