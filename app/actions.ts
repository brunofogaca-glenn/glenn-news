"use server";

import { revalidateTag } from "next/cache";
import { getCachedArticles } from "@/lib/articlesCache";
import { addWeeklyReadLink } from "@/lib/weeklyRead";
import { getCachedEditionMeta } from "@/lib/editionMeta";
import { getCachedSportDay } from "@/lib/sportDayCache";

export async function refreshNews() {
  revalidateTag("glenn-news-articles", { expire: 0 });
  await getCachedArticles();
  revalidateTag("glenn-news-sport-day", { expire: 0 });
  await getCachedSportDay();
  revalidateTag("glenn-news-edition-meta", { expire: 0 });
  const editionMeta = await getCachedEditionMeta();
  return { refreshedAt: editionMeta.updatedAt };
}


export async function markWeeklyRead(link: string) {
  if (!link || !/^https?:\/\//i.test(link)) {
    throw new Error("Ogiltig artikel-länk");
  }

  await addWeeklyReadLink(link);
}
