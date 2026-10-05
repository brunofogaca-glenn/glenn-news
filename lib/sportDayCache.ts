import { unstable_cache } from "next/cache";
import { fetchSportDay } from "./sportDay";

export const getCachedSportDay = unstable_cache(
  async () => fetchSportDay(),
  ["glenn-news-sport-day-cache-v1"],
  {
    revalidate: 60 * 60,
    tags: ["glenn-news-sport-day"],
  }
);
