import { unstable_cache } from "next/cache";
import { getArticles } from "./rss";

const getCachedArticlesInternal = unstable_cache(
  async () => getArticles(),
  ["glenn-news-articles-v1"],
  {
    revalidate: 24 * 60 * 60,
    tags: ["glenn-news-articles"],
  }
);

export async function getCachedArticles() {
  return getCachedArticlesInternal();
}
