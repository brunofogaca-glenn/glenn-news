import { revalidateTag } from "next/cache";
import { getCachedArticles } from "@/lib/articlesCache";
import { getCachedFeedHealth } from "@/lib/feedHealthCache";
import { getCachedEditionMeta } from "@/lib/editionMeta";
import { getDailyHeaderInfo } from "@/lib/dailyHeader";
import { getCachedSportDay } from "@/lib/sportDayCache";

export const dynamic = "force-dynamic";

const TIME_ZONE = "Europe/Stockholm";

function getLocalClock(date: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(
    parts.find(part => part.type === "hour")?.value ?? "0"
  );
  const minute = Number(
    parts.find(part => part.type === "minute")?.value ?? "0"
  );

  return { hour, minute };
}

function totalArticles(news: Record<string, unknown>): number {
  return Object.values(news).reduce<number>((sum, value) => {
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const userAgent = request.headers.get("user-agent");

  if (cronSecret) {
    return authorization === `Bearer ${cronSecret}`;
  }

  return userAgent === "vercel-cron/1.0";
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const localClock = getLocalClock(now);

  // Two UTC cron entries handle Sweden's switch between CET and CEST.
  // Only the invocation that lands in the 07:00 hour performs the refresh.
  if (localClock.hour !== 7) {
    return Response.json({
      ok: true,
      refreshed: false,
      reason: "Outside the 07:00 Stockholm hour",
      localTime: `${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}`,
    });
  }

  revalidateTag("glenn-news-articles", { expire: 0 });
  const news = await getCachedArticles();

  revalidateTag("glenn-news-feed-health", { expire: 0 });
  const feedHealth = await getCachedFeedHealth();

  revalidateTag("glenn-news-sport-day", { expire: 0 });
  const sportDay = await getCachedSportDay();

  revalidateTag("glenn-news-edition-meta", { expire: 0 });
  const editionMeta = await getCachedEditionMeta();
  const dailyHeader = await getDailyHeaderInfo();

  return Response.json({
    ok: true,
    refreshed: true,
    localTime: `${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}`,
    refreshedAt: now.toISOString(),
    totalArticles: totalArticles(news),
    feedHealth: feedHealth.totals,
    editionUpdatedAt: editionMeta.updatedAt,
    dailyHeader,
    sport: {
      results: sportDay.results.length,
      upcoming: sportDay.upcoming.length,
      provider: sportDay.provider,
    },
  });
}
