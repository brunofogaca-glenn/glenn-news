import { revalidateTag } from "next/cache";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import { recordDiagnostic } from "@/lib/diagnosticLog";
import { getCachedWeather } from "@/lib/weather";
import { getCachedSportDay } from "@/lib/sportDayCache";
import { getCachedMarketDay } from "@/lib/marketDay";
import {
  getCachedCultureSnapshot,
  getCachedLocalSnapshot,
  getCachedNationalSnapshot,
  getCachedWorldSnapshot,
} from "@/lib/dailySnapshots";
import { getDailyHeaderInfo } from "@/lib/dailyHeader";
import { getStockholmClock } from "@/lib/updateSchedule";
import type { SupplementalRefreshMeta } from "@/lib/supplementalCache";
import { getSupplementalRefreshRun, saveSupplementalRefreshRun } from "@/lib/supplementalRefreshRun";

export const dynamic = "force-dynamic";

type RefreshedValue = { [key: string]: unknown; refreshMeta?: SupplementalRefreshMeta };
type Source = {
  name: string;
  tag: string;
  refreshIntervalMs: number;
  load: () => Promise<RefreshedValue>;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const RETRY_MS = 25 * MINUTE_MS;

const SOURCES: Source[] = [
  { name: "väder", tag: "glenn-news-weather", refreshIntervalMs: HOUR_MS, load: getCachedWeather },
  { name: "sport och tabeller", tag: "glenn-news-sport-day", refreshIntervalMs: HOUR_MS, load: getCachedSportDay },
  { name: "marknad", tag: "glenn-news-market-day", refreshIntervalMs: DAY_MS, load: getCachedMarketDay },
  { name: "lokalt och Borås Stad", tag: "glenn-news-daily-local", refreshIntervalMs: 2 * HOUR_MS, load: getCachedLocalSnapshot },
  { name: "riksdagen", tag: "glenn-news-daily-national", refreshIntervalMs: HOUR_MS, load: getCachedNationalSnapshot },
  { name: "världsdata", tag: "glenn-news-daily-world", refreshIntervalMs: 3 * HOUR_MS, load: getCachedWorldSnapshot },
  { name: "kultur", tag: "glenn-news-daily-culture", refreshIntervalMs: 4 * HOUR_MS, load: getCachedCultureSnapshot },
  { name: "namnsdag och historik", tag: "glenn-news-daily-header", refreshIntervalMs: WEEK_MS, load: getDailyHeaderInfo },
];

function due(meta: SupplementalRefreshMeta | undefined, now: number, refreshIntervalMs: number) {
  if (!meta) return true;
  if (meta.status === "stale") {
    const attempted = Date.parse(meta.lastAttemptAt);
    return !Number.isFinite(attempted) || now - attempted >= RETRY_MS;
  }
  const lastSuccess = Date.parse(meta.lastSuccessAt ?? "");
  return !Number.isFinite(lastSuccess) || now - lastSuccess >= refreshIntervalMs - 5 * MINUTE_MS;
}

function describe(
  name: string,
  value: RefreshedValue | null,
  error?: unknown,
  skipped = false
) {
  const meta = value?.refreshMeta;
  return {
    name,
    status: error ? "failed" : skipped && meta?.status !== "stale" ? "cached" : meta?.status ?? "unknown",
    lastSuccessAt: meta?.lastSuccessAt ?? null,
    persistent: meta?.persistent ?? false,
    error: error instanceof Error ? error.message : error ? String(error) : meta?.lastError ?? null,
  };
}

function stockholmDateKey(date: Date) {
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

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const authorizedVercelCron = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
  if (!authorizedVercelCron && !(await authorizeGitHubActionsRefresh(request, "supplemental"))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const now = new Date();
  const clock = getStockholmClock(now);
  if (clock.hour < 1) {
    return Response.json({
      ok: false,
      skipped: true,
      error: "Supplemental refresh is only allowed from 01:00 to 05:59 Europe/Stockholm",
      localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    }, { status: 503 });
  }
  if (clock.hour >= 6) {
    return Response.json({
      ok: false,
      skipped: true,
      error: "Supplemental refresh missed its 01:00–05:59 Europe/Stockholm window; no daytime Blob writes were performed",
      localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    }, { status: 503 });
  }

  // The backup invocation is cheap when today's full refresh already succeeded.
  // Failed/incomplete runs remain eligible for retry, while manual recovery can force a run.
  if (!force) {
    const previousRun = await getSupplementalRefreshRun();
    const previousTime = previousRun?.checkedAt ? Date.parse(previousRun.checkedAt) : NaN;
    if (previousRun?.ok && Number.isFinite(previousTime) &&
        stockholmDateKey(new Date(previousTime)) === stockholmDateKey(now)) {
      return Response.json({
        ok: true,
        refreshed: false,
        skipped: true,
        reason: "Today's supplemental refresh already succeeded; backup run skipped",
        previousRunAt: previousRun.checkedAt,
        localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
      });
    }
  }

  // Probe the existing cache first. Cache hits do not refetch the source; metadata
  // tells us whether the source-specific refresh interval elapsed or a failed source needs retrying.
  const probes = await Promise.allSettled(SOURCES.map(source => source.load()));
  const dueSources = SOURCES.filter((source, index) => {
    const probe = probes[index];
    return force || probe.status === "rejected" || due(probe.value.refreshMeta, now.getTime(), source.refreshIntervalMs);
  });

  const refreshed = await Promise.all(dueSources.map(async source => {
    const probeIndex = SOURCES.findIndex(item => item.name === source.name);
    const probe = probes[probeIndex];
    if (probe.status === "rejected") {
      await recordDiagnostic({ level: "error", component: "refresh.supplemental", message: "Kompletterande datakälla gav ett oväntat fel", error: probe.reason, context: { source: source.name, route: "/api/cron/refresh-data" } });
      return describe(source.name, null, probe.reason);
    }

    try {
      revalidateTag(source.tag, { expire: 0 });
      const value = await source.load();
      return describe(source.name, value);
    } catch (error) {
      await recordDiagnostic({ level: "error", component: "refresh.supplemental", message: "Uppdatering av kompletterande datakälla misslyckades", error, context: { source: source.name, route: "/api/cron/refresh-data" } });
      return describe(source.name, probe.value, error);
    }
  }));

  const cached = SOURCES
    .filter(source => !dueSources.some(dueSource => dueSource.name === source.name))
    .map(source => {
      const probe = probes[SOURCES.findIndex(item => item.name === source.name)];
      return describe(source.name, probe.status === "fulfilled" ? probe.value : null,
        probe.status === "rejected" ? probe.reason : undefined, true);
    });

  const sources = [...refreshed, ...cached];
  const failures = sources.filter(source => source.status === "failed").length;
  const stale = sources.filter(source => source.status === "stale").length;

  const report = {
    checkedAt: new Date().toISOString(),
    ok: failures === 0 && stale === 0 && sources.every(source => source.persistent),
    refreshed: dueSources.length > 0,
    localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    cadence: "two Vercel Cron windows; stale sources retry on the next eligible run",
    articleFeedsTouched: false as const,
    refreshedSources: dueSources.length,
    failures,
    stale,
    sources,
  };
  const statusSaved = await saveSupplementalRefreshRun(report);
  return Response.json({ ...report, statusSaved, ok: report.ok && statusSaved }, {
    status: !report.ok || !statusSaved ? 503 : 200,
  });
}
