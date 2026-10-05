"use server";

import { revalidateTag } from "next/cache";
import { getCachedArticles } from "@/lib/articlesCache";
import { addWeeklyReadLink } from "@/lib/weeklyRead";

export async function refreshNews() {
  revalidateTag("glenn-news-articles", { expire: 0 });
  await getCachedArticles();
  return { refreshedAt: new Date().toISOString() };
}


export async function markWeeklyRead(link: string) {
  if (!link || !/^https?:\/\//i.test(link)) {
    throw new Error("Ogiltig artikel-länk");
  }

  await addWeeklyReadLink(link);
}
