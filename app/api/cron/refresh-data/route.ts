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
import { saveSupplementalRefreshRun } from "@/lib/supplementalRefreshRun";

export const dynamic = "force-dynamic";

type RefreshedValue = { [key: string]: unknown; refreshMeta?: SupplementalRefreshMeta };
type Source = {
  name: string;
  tag: string;
  load: () => Promise<RefreshedValue>;
};

const SOURCES: Source[] = [
  { name: "väder", tag: "glenn-news-weather", load: getCachedWeather },
  { name: "sport och tabeller", tag: "glenn-news-sport-day", load: getCachedSportDay },
  { name: "marknad", tag: "glenn-news-market-day", load: getCachedMarketDay },
  { name: "lokalt och Borås Stad", tag: "glenn-news-daily-local", load: getCachedLocalSnapshot },
  { name: "riksdagen", tag: "glenn-news-daily-national", load: getCachedNationalSnapshot },
  { name: "världsdata", tag: "glenn-news-daily-world", load: getCachedWorldSnapshot },
  { name: "kultur", tag: "glenn-news-daily-culture", load: getCachedCultureSnapshot },
  { name: "namnsdag och historik", tag: "glenn-news-daily-header", load: getDailyHeaderInfo },
];

const HOUR_MS = 60 * 60 * 1000;
const RETRY_MS = 25 * 60 * 1000;

function due(meta: SupplementalRefreshMeta | undefined, now: number) {
  if (!meta) return true;
  if (meta.status === "stale") {
    const attempted = Date.parse(meta.lastAttemptAt);
    return !Number.isFinite(attempted) || now - attempted >= RETRY_MS;
  }
  const lastSuccess = Date.parse(meta.lastSuccessAt ?? "");
  return !Number.isFinite(lastSuccess) || now - lastSuccess >= HOUR_MS - 5 * 60 * 1000;
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

export async function GET(request: Request) {
  if (!(await authorizeGitHubActionsRefresh(request, "supplemental"))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const clock = getStockholmClock(now);
  if (clock.hour < 1) {
    return Response.json({
      ok: true,
      refreshed: false,
      reason: "Supplemental refresh starts at 01:00 Europe/Stockholm",
      localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    });
  }
  if (clock.hour >= 6) {
    return Response.json({
      ok: true,
      refreshed: false,
      skipped: true,
      reason: "Nightly maintenance cutoff passed; no daytime Blob writes are allowed",
      localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    });
  }

  // Probe the existing cache first. Cache hits do not refetch the source; metadata
  // tells us whether the hourly refresh is due or whether a failed source needs retrying.
  const probes = await Promise.allSettled(SOURCES.map(source => source.load()));
  const dueSources = SOURCES.filter((source, index) => {
    const probe = probes[index];
    return probe.status === "rejected" || due(probe.value.refreshMeta, now.getTime());
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
    ok: failures === 0 && stale === 0,
    refreshed: dueSources.length > 0,
    localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    cadence: "hourly; stale sources retry on the next half-hour run",
    articleFeedsTouched: false as const,
    refreshedSources: dueSources.length,
    failures,
    stale,
    sources,
  };
  const statusSaved = await saveSupplementalRefreshRun(report);
  return Response.json({ ...report, statusSaved }, {
    status: failures > 0 || stale > 0 ? 503 : 200,
  });
}
