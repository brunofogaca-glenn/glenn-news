import { unstable_cache } from "next/cache";
import { getFeedHealth } from "./feedHealth";

const getCachedFeedHealthInternal = unstable_cache(
  async () => getFeedHealth(),
  ["glenn-news-feed-health-v1"],
  {
    revalidate: 24 * 60 * 60,
    tags: ["glenn-news-feed-health"],
  }
);

export async function getCachedFeedHealth() {
  return getCachedFeedHealthInternal();
}
