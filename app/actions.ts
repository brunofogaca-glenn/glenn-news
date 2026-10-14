"use server";

import { revalidateTag } from "next/cache";
import { getCachedArticles } from "@/lib/articlesCache";
import { addWeeklyReadLink } from "@/lib/weeklyRead";
import { getCachedSportDay } from "@/lib/sportDayCache";
import { getCachedMarketDay } from "@/lib/marketDay";
import { getReaderProfile } from "@/lib/readerProfile";
import { generateMorningEdition } from "@/lib/dailyEdition";

export async function refreshNews() {
  revalidateTag("glenn-news-articles", { expire: 0 });
  await getCachedArticles();
  revalidateTag("glenn-news-sport-day", { expire: 0 });
  await getCachedSportDay();
  revalidateTag("glenn-news-market-day", { expire: 0 });
  await getCachedMarketDay();
  return { sourcesRefreshedAt: new Date().toISOString() };
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
