import { unstable_cache } from "next/cache";
import { getArticles } from "./rss";

const getCachedArticlesInternal = unstable_cache(
  async () => getArticles(),
  ["glenn-news-articles-v2"],
  {
    revalidate: 30 * 60,
    tags: ["glenn-news-articles"],
  }
);

export async function getCachedArticles() {
  return getCachedArticlesInternal();
}
