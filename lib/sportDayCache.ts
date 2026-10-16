import { unstable_cache } from "next/cache";
import { fetchSportDay } from "./sportDay";
import { withLastGoodSnapshot } from "./supplementalCache";

export const getCachedSportDay = unstable_cache(
  async () => withLastGoodSnapshot("sport-day", fetchSportDay),
  ["glenn-news-sport-day-cache-v8"],
  {
    revalidate: 60 * 60,
    tags: ["glenn-news-sport-day"],
  }
);
