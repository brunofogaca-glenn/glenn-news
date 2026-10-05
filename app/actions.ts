"use server";

import { revalidateTag } from "next/cache";
import { getCachedArticles } from "@/lib/articlesCache";

export async function refreshNews() {
  revalidateTag("glenn-news-articles", { expire: 0 });
  await getCachedArticles();
  return { refreshedAt: new Date().toISOString() };
}
