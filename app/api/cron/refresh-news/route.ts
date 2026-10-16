import { revalidateTag } from "next/cache";
import { getCachedArticles } from "@/lib/articlesCache";
import { getCachedFeedHealth } from "@/lib/feedHealthCache";
import { getReaderProfile } from "@/lib/readerProfile";
import {
  generateMorningEdition,
  hasFreshMorningEditionForToday,
} from "@/lib/dailyEdition";

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

  // Three daily scheduled attempts (06:30, 06:34, 06:38 Stockholm)
  // cover a transient failure. The duplicate UTC schedules handle CET/CEST;
  // only the schedule matching the active Swedish offset reaches this window.
  if (localClock.hour !== 6 || localClock.minute < 30 || localClock.minute > 39) {
    return Response.json({
      ok: true,
      refreshed: false,
      reason: "Outside the 06:30-06:39 Stockholm publication window",
      localTime: `${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}`,
    });
  }

  // Later scheduled invocations are retries, not a reason to regenerate a
  // valid edition or refetch every source. Retry only if today's edition is
  // still missing, invalid, too early, or repeats recent articles.
  if (localClock.minute > 30 && await hasFreshMorningEditionForToday()) {
    return Response.json({
      ok: true,
      refreshed: false,
      reason: "Today's morning edition is already published; retry skipped",
      localTime: `${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}`,
    });
  }

  revalidateTag("glenn-news-articles", { expire: 0 });
  const news = await getCachedArticles();

  revalidateTag("glenn-news-feed-health", { expire: 0 });
  const feedHealth = await getCachedFeedHealth();

  // Generate and persist the one morning edition after refreshing its source data.
  const profile = await getReaderProfile();
  const edition = await generateMorningEdition(profile);

  return Response.json({
    ok: true,
    refreshed: true,
    localTime: `${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}`,
    refreshedAt: now.toISOString(),
    totalArticles: totalArticles(news),
    feedHealth: feedHealth.totals,
    articleFeedsTouched: true,
    morningEditionDate: edition.dateKey,
    morningEditionGeneratedAt: edition.generatedAt,
    morningEditionArticles: edition.totalArticles,
  });
}
