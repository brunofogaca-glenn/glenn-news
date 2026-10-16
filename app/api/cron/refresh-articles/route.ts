import { revalidateTag } from "next/cache";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import { recordDiagnostic } from "@/lib/diagnosticLog";
import { getCachedArticles } from "@/lib/articlesCache";
import { getCachedFeedHealth } from "@/lib/feedHealthCache";
import { canRefreshEditorialSourcesNow, getStockholmClock } from "@/lib/updateSchedule";
import { getArticleRefreshStatus, saveArticleRefreshStatus, type ArticleRefreshStatus } from "@/lib/articleRefreshStatus";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const RETRY_MS = 25 * 60 * 1000;
const MAX_ERROR_RATE = 0.25;
const MIN_ERRORS_TO_RETRY = 5;

function stockholmDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find(part => part.type === "year")?.value ?? "0000";
  const month = parts.find(part => part.type === "month")?.value ?? "00";
  const day = parts.find(part => part.type === "day")?.value ?? "00";
  return year + "-" + month + "-" + day;
}

function totalArticles(news: Record<string, unknown>) {
  return Object.values(news).reduce<number>(
    (sum, value) => sum + (Array.isArray(value) ? value.length : 0),
    0
  );
}

function shouldSkip(status: ArticleRefreshStatus | null, now: number) {
  if (!status) return false;
  if (status.status === "retry") {
    const attemptedAt = Date.parse(status.lastAttemptAt);
    return Number.isFinite(attemptedAt) && now - attemptedAt < RETRY_MS;
  }
  const successAt = Date.parse(status.lastSuccessAt ?? "");
  return Number.isFinite(successAt) && now - successAt < HOUR_MS - 5 * 60 * 1000;
}

function clockLabel(date: Date) {
  const { hour, minute } = getStockholmClock(date);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  if (!(await authorizeGitHubActionsRefresh(request, "editorial"))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  if (!canRefreshEditorialSourcesNow()) {
    return Response.json({
      ok: true,
      refreshed: false,
      reason: "Editorial article ingestion starts at 06:00 Europe/Stockholm",
      localTime: clockLabel(now),
      articleSourcesTouched: false,
    });
  }

  const dateKey = stockholmDateKey(now);
  const existing = await getArticleRefreshStatus(dateKey);
  if (shouldSkip(existing, now.getTime())) {
    return Response.json({
      ok: true,
      refreshed: false,
      reason: existing?.status === "retry"
        ? "Retry is not due yet; next half-hour invocation will retry"
        : "Article sources were refreshed less than an hour ago",
      localTime: clockLabel(now),
      articleSourcesTouched: false,
      status: existing,
    });
  }

  const attemptedAt = now.toISOString();
  let articles = 0;
  let errors = 0;
  let stale = 0;
  let message = "";

  try {
    revalidateTag("glenn-news-articles", { expire: 0 });
    const news = await getCachedArticles();
    articles = totalArticles(news);

    revalidateTag("glenn-news-feed-health", { expire: 0 });
    const health = await getCachedFeedHealth();
    errors = health.totals.errors;
    stale = health.totals.stale;

    const errorLimit = Math.max(
      MIN_ERRORS_TO_RETRY,
      Math.ceil(health.totals.all * MAX_ERROR_RATE)
    );
    const failed = articles === 0 || errors >= errorLimit;

    const status: ArticleRefreshStatus = {
      dateKey,
      status: failed ? "retry" : "ok",
      lastAttemptAt: attemptedAt,
      lastSuccessAt: failed ? (existing?.lastSuccessAt ?? null) : new Date().toISOString(),
      articleCount: articles,
      feedErrors: errors,
      staleFeeds: stale,
      message: failed
        ? articles === 0
          ? "Inga artiklar kunde cachas; försök igen vid nästa halvtimme."
          : `${errors} av ${health.totals.all} artikelkällor rapporterar fel; gränsen för ett lyckat flöde överskreds.`
        : stale > 0
          ? `${stale} källor har äldre publicerat innehåll; artikelhämtningen lyckades.`
          : undefined,
    };

    const statusSaved = await saveArticleRefreshStatus(status);
    return Response.json({
      ok: !failed,
      refreshed: true,
      localTime: clockLabel(now),
      articleSourcesTouched: true,
      statusSaved,
      status,
    }, { status: failed ? 503 : 200 });
  } catch (error) {
    await recordDiagnostic({ level: "error", component: "refresh.articles", message: "Schemalagd artikeluppdatering misslyckades", error, context: { route: "/api/cron/refresh-articles", operation: "refresh-articles" } });
    message = error instanceof Error ? error.message : String(error);
    const status: ArticleRefreshStatus = {
      dateKey,
      status: "retry",
      lastAttemptAt: attemptedAt,
      lastSuccessAt: existing?.lastSuccessAt ?? null,
      articleCount: articles,
      feedErrors: errors,
      staleFeeds: stale,
      message: message.slice(0, 500),
    };
    const statusSaved = await saveArticleRefreshStatus(status);

    return Response.json({
      ok: false,
      refreshed: true,
      localTime: clockLabel(now),
      articleSourcesTouched: true,
      statusSaved,
      status,
    }, { status: 503 });
  }
}
