import { unstable_cache } from "next/cache";
import { getCachedSportDay as getSportDayData } from "./sportDay";

export const getCachedSportDay = unstable_cache(
  async () => getSportDayData(),
  ["glenn-news-sport-day-cache-v1"],
  {
    revalidate: 60 * 60,
    tags: ["glenn-news-sport-day"],
  }
);
