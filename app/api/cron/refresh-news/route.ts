import { revalidateTag } from "next/cache";
import { recordDiagnostic } from "@/lib/diagnosticLog";
import { getCachedArticles } from "@/lib/articlesCache";
import { getCachedFeedHealth } from "@/lib/feedHealthCache";
import { getArticleRefreshStatus, saveArticleRefreshStatus, type ArticleRefreshStatus } from "@/lib/articleRefreshStatus";
import { getReaderProfile } from "@/lib/readerProfile";
import {
  generateMorningEdition,
  hasFreshMorningEditionForToday,
} from "@/lib/dailyEdition";

export const dynamic = "force-dynamic";

const TIME_ZONE = "Europe/Stockholm";
const MAX_ERROR_RATE = 0.25;
const MIN_ERRORS_TO_RETRY = 5;

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

function stockholmDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value ?? "0000";
  const month = parts.find(part => part.type === "month")?.value ?? "00";
  const day = parts.find(part => part.type === "day")?.value ?? "00";
  return year + "-" + month + "-" + day;
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  // Fail closed. Vercel Cron supplies this bearer token when CRON_SECRET is set;
  // User-Agent alone is spoofable and must never authorize a public refresh route.
  return Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
}

async function runRefresh(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const localClock = getLocalClock(now);

  // Hobby Cron may run at any minute within the selected UTC hour. The CET/CEST
  // schedule pair is intentionally gated by Stockholm's full 06:00-06:59 hour.
  if (localClock.hour !== 6) {
    return Response.json({
      ok: true,
      refreshed: false,
      reason: "Outside the 06:00-06:59 Stockholm publication hour",
      localTime: `${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}`,
    });
  }

  // Two invocations can land anywhere in the same Hobby hour. Once a valid
  // edition exists, skip further source refreshes unless its recorded status
  // explicitly requests a retry.
  if (await hasFreshMorningEditionForToday()) {
    const previousStatus = await getArticleRefreshStatus(stockholmDateKey(now));
    if (previousStatus?.status !== "retry") {
      return Response.json({
        ok: true,
        refreshed: false,
        reason: "Today's morning edition is already published; retry skipped",
        localTime: `${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}`,
      });
    }
  }

  revalidateTag("glenn-news-articles", { expire: 0 });
  const news = await getCachedArticles();

  revalidateTag("glenn-news-feed-health", { expire: 0 });
  const feedHealth = await getCachedFeedHealth();

  // The morning job owns the daily article refresh status too, avoiding a
  // separate hourly workflow that repeats the same RSS and health work.
  const articleCount = totalArticles(news);
  const errorLimit = Math.max(
    MIN_ERRORS_TO_RETRY,
    Math.ceil(feedHealth.totals.all * MAX_ERROR_RATE)
  );
  const articleRefreshFailed =
    articleCount === 0 || feedHealth.totals.errors >= errorLimit;
  const articleStatus: ArticleRefreshStatus = {
    dateKey: stockholmDateKey(now),
    status: articleRefreshFailed ? "retry" : "ok",
    lastAttemptAt: now.toISOString(),
    lastSuccessAt: articleRefreshFailed ? null : now.toISOString(),
    articleCount,
    feedErrors: feedHealth.totals.errors,
    staleFeeds: feedHealth.totals.stale,
    message: articleRefreshFailed
      ? articleCount === 0
        ? "Inga artiklar kunde cachas; en andra schemalagd körning kan försöka igen under publiceringsfönstret."
        : `${feedHealth.totals.errors} av ${feedHealth.totals.all} artikelkällor rapporterar fel; gränsen för ett lyckat flöde överskreds.`
      : feedHealth.totals.stale > 0
        ? `${feedHealth.totals.stale} källor har äldre publicerat innehåll; artikelhämtningen lyckades.`
        : undefined,
  };
  const articleRefreshStatusSaved = await saveArticleRefreshStatus(articleStatus);

  // Generate and persist the one morning edition after refreshing its source data.
  const profile = await getReaderProfile();
  const edition = await generateMorningEdition(profile);

  return Response.json({
    ok: true,
    refreshed: true,
    localTime: `${String(localClock.hour).padStart(2, "0")}:${String(localClock.minute).padStart(2, "0")}`,
    refreshedAt: now.toISOString(),
    totalArticles: articleCount,
    articleRefreshStatusSaved,
    feedHealth: feedHealth.totals,
    articleFeedsTouched: true,
    morningEditionDate: edition.dateKey,
    morningEditionGeneratedAt: edition.generatedAt,
    morningEditionArticles: edition.totalArticles,
  });
}


export async function GET(request: Request) {
  try {
    return await runRefresh(request);
  } catch (error) {
    await recordDiagnostic({
      level: "error",
      component: "refresh.morning-edition",
      message: "Schemalagd uppdatering av morgoneditionen misslyckades",
      error,
      context: { route: "/api/cron/refresh-news", operation: "publish-morning-edition" },
    });
    console.error("Schemalagd morgonuppdatering misslyckades:", error);
    return Response.json(
      { ok: false, error: "Morning edition refresh failed; diagnostic log recorded when storage is available." },
      { status: 500 }
    );
  }
}
