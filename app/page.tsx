import { withOptionalFallback } from "@/lib/optionalData";
import { canRefreshEditorialSourcesNow } from "@/lib/updateSchedule";
import { ManualRefreshButton } from "./components/ManualRefreshButton";
import { RetryMorningEditionButton } from "./components/RetryMorningEditionButton";
import { TrackableLink } from "./components/TrackableLink";
import { getReaderProfile } from "@/lib/readerProfile";
import { getCachedFeedHealth } from "@/lib/feedHealthCache";
import { getDailyHeaderInfo } from "@/lib/dailyHeader";
import { getCachedWeather } from "@/lib/weather";
import { getCachedSportDay } from "@/lib/sportDayCache";
import { getCachedMarketDay } from "@/lib/marketDay";
import { getTodayDailyEdition } from "@/lib/dailyEdition";
import { MarketDayPanel } from "./components/MarketDayPanel";
import { SportDayPanel } from "./components/SportDayPanel";
import {
  CultureSnapshotPanel,
  LocalSnapshotPanel,
  NationalSnapshotPanel,
  WorldSnapshotPanel,
} from "./components/DailySnapshotPanels";
import {
  getCachedCultureSnapshot,
  getCachedLocalSnapshot,
  getCachedNationalSnapshot,
  getCachedWorldSnapshot,
} from "@/lib/dailySnapshots";
import { ReaderCount } from "./components/ReaderCount";
import type { EditorialSection } from "@/lib/editorV2";

export const dynamic = "force-dynamic";

const CATEGORY_ACCENTS = {
  elfsborg: "text-yellow-700",
  boras: "text-orange-700",
  sverige: "text-blue-700",
  varlden: "text-emerald-700",
  ekonomi: "text-amber-800",
  fotboll: "text-slate-900",
  sport: "text-cyan-700",
  livsstil: "text-pink-700",
} as const;

function getStockholmDateKey(date = new Date()) {
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

function formatEditionDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatEditionTimestamp(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function formatDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function isWeekend() {
  const weekday = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "short",
  }).format(new Date());

  return weekday === "lör" || weekday === "sön";
}

function ArticleImage({
  src,
  alt,
  priority = false,
}: {
  src?: string | null;
  alt: string;
  priority?: boolean;
}) {
  return (
    <div className="mobile-article-media relative aspect-[16/9] w-full overflow-hidden bg-slate-200">
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-800">
          <span className="font-serif text-3xl font-bold text-white/80">
            Glenn News
          </span>
        </div>
      )}
    </div>
  );
}

type MixedHomepageStory = {
  categoryKey: string;
  categoryTitle: string;
  story: EditorialSection["stories"][number];
};

/** Stable daily interleaving: keeps each category's editorial ranking intact,
 * but alternates categories so the reader never scrolls through category blocks. */
function feedOrderHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildMixedHomepageFeed(
  sections: EditorialSection[],
  dateKey: string
): MixedHomepageStory[] {
  const buckets = sections
    .map(section => ({
      categoryKey: section.key,
      categoryTitle: section.title,
      // Elfsborg deliberately uses its complete coverage pool, as on the old page.
      stories: section.key === "elfsborg" && section.allArticles?.length
        ? section.allArticles
        : section.stories,
      cursor: 0,
    }))
    .filter(bucket => bucket.stories.length > 0);

  const feed: MixedHomepageStory[] = [];
  let round = 0;
  let lastCategory = "";

  while (buckets.some(bucket => bucket.cursor < bucket.stories.length)) {
    const active = buckets
      .filter(bucket => bucket.cursor < bucket.stories.length)
      .sort((a, b) =>
        feedOrderHash(dateKey + ":" + round + ":" + a.categoryKey) -
        feedOrderHash(dateKey + ":" + round + ":" + b.categoryKey)
      );

    // Avoid a category repeat at the round boundary whenever another category
    // still has articles. The daily seed changes the sequence without randomness.
    if (active.length > 1 && active[0].categoryKey === lastCategory) {
      const nextDifferent = active.findIndex(bucket => bucket.categoryKey !== lastCategory);
      if (nextDifferent > 0) {
        const [different] = active.splice(nextDifferent, 1);
        active.unshift(different);
      }
    }

    for (const bucket of active) {
      const story = bucket.stories[bucket.cursor++];
      feed.push({
        categoryKey: bucket.categoryKey,
        categoryTitle: bucket.categoryTitle,
        story,
      });
      lastCategory = bucket.categoryKey;
    }
    round += 1;
  }

  return feed;
}

function buildOverviewHighlights(sections: EditorialSection[], dateKey: string) {
  return sections
    .map(section => {
      const lead = section.stories[0] ?? section.allArticles?.[0];
      // Prefer the short AI summary attached to the leading story. The section
      // summary is only a fallback, because it is intentionally more expansive.
      const summary = (lead?.aiSummary || section.summary || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!summary) return null;

      const firstSentence = summary.match(/^.*?[.!?](?=\s|$)/)?.[0]?.trim() ?? summary;
      const words = firstSentence.split(/\s+/);
      const text = words.length > 24
        ? words.slice(0, 23).join(" ").replace(/[,:;–-]?$/, "") + "…"
        : firstSentence;

      const priority =
        (lead?.newsScore ?? lead?.score ?? 0) * 0.55 +
        (lead?.readingScore ?? 0) * 0.3 +
        (lead?.publicImportanceScore ?? 0) * 0.15 +
        (lead?.personalizationScore ?? 0) * 0.05;

      return {
        text,
        priority,
        tieBreak: feedOrderHash(dateKey + ":" + section.key),
      };
    })
    .filter((item): item is { text: string; priority: number; tieBreak: number } => Boolean(item))
    .sort((a, b) => b.priority - a.priority || a.tieBreak - b.tieBreak)
    .slice(0, 3)
    .map(item => item.text);
}


export default async function Home() {
  const profilePromise = withOptionalFallback("reader profile", getReaderProfile(), () => ({
    category: {},
    articleType: {},
    source: {},
    topic: {},
    totalClicks: 0,
    lastUpdated: null,
  }));
  // Start the essential edition as soon as the reader profile is ready,
  // without waiting for slower optional panels such as weather or markets.
  const editionPromise = profilePromise.then(profile => getTodayDailyEdition(profile));

  const [
    profile,
    feedHealth,
    dailyHeader,
    weather,
    sportDay,
    marketDay,
    localSnapshot,
    nationalSnapshot,
    worldSnapshot,
    cultureSnapshot,
    edition,
  ] = await Promise.all([
    profilePromise,
    canRefreshEditorialSourcesNow()
      ? withOptionalFallback("feed health", getCachedFeedHealth(), () => ({
          checkedAt: new Date().toISOString(),
          feeds: [{
            kind: "Webb" as const,
            name: "Flödesstatus kunde inte hämtas",
            url: "/health",
            category: "system",
            status: "error" as const,
            responseMs: 0,
            articles24h: 0,
            latestArticleAt: null,
            latestArticleAgeHours: null,
            detail: "Kontrollen av RSS- och webbkällor kunde inte hämtas just nu.",
          }],
          totals: { all: 1, healthy: 0, empty: 0, stale: 0, errors: 1 },
        }))
      : Promise.resolve({
          checkedAt: new Date().toISOString(),
          feeds: [],
          totals: { all: 0, healthy: 0, empty: 0, stale: 0, errors: 0 },
        }),
    withOptionalFallback("daily header", getDailyHeaderInfo(), () => ({
      namedays: [],
      historicalEvent: null,
    })),
    withOptionalFallback("weather", getCachedWeather(), () => ({
      location: "Borås",
      days: [],
      fetchedAt: new Date().toISOString(),
    })),
    withOptionalFallback("sport day", getCachedSportDay(), () => ({
      results: [],
      upcoming: [],
      selectedLeague: null,
      provider: { apiFootball: false, sportmonks: false },
      fetchedAt: new Date().toISOString(),
    })),
    withOptionalFallback("market day", getCachedMarketDay(), () => ({
      date: new Date().toISOString().slice(0, 10),
      indices: [],
      source: "Yahoo Finance · historiska stängningar" as const,
      error: "Marknadsinformationen kunde inte hämtas just nu.",
    })),
    withOptionalFallback("local snapshot", getCachedLocalSnapshot(), () => ({
      events: [],
      meetings: [],
      eventSource: "boras.com" as const,
      updatedAt: new Date().toISOString(),
      sources: [],
    })),
    withOptionalFallback("national snapshot", getCachedNationalSnapshot(), () => ({
      agenda: [],
      news: [],
      updatedAt: new Date().toISOString(),
      sources: [],
    })),
    withOptionalFallback("world snapshot", getCachedWorldSnapshot(), () => ({
      markets: [],
      rates: [],
      gdp: [],
      updatedAt: new Date().toISOString(),
      warnings: ["Världsdata kunde inte hämtas just nu."],
    })),
    withOptionalFallback("culture snapshot", getCachedCultureSnapshot(), () => ({
      filmReviews: [],
      albumReviews: [],
      updatedAt: new Date().toISOString(),
      filmReviewSourceUrl: "https://www.dn.se/rss/om/filmrecensioner/",
      albumReviewSourceUrl: "https://www.dn.se/rss/om/skivrecensioner/",
    })),
    editionPromise,
  ]);

  const sections = edition.sections;
  const totalArticles = edition.totalArticles;
  const todayDateKey = getStockholmDateKey();
  const isFallbackEdition = edition.dateKey !== todayDateKey;
  const isUnavailableEdition =
    !isFallbackEdition &&
    totalArticles <= 0 &&
    sections.every(section => section.stories.length === 0);

  const mixedStories = buildMixedHomepageFeed(sections, edition.dateKey);
  const overviewHighlights = buildOverviewHighlights(sections, edition.dateKey);
  const factPanelAfter = Array.from({ length: 6 }, (_, index) =>
    Math.max(0, Math.floor(((index + 1) * mixedStories.length) / 7) - 1)
  );
  const factPanelsByPosition = new Map<number, number[]>();
  factPanelAfter.forEach((position, panelIndex) => {
    factPanelsByPosition.set(position, [
      ...(factPanelsByPosition.get(position) ?? []),
      panelIndex,
    ]);
  });

  return (
    <main className="min-h-screen bg-[#f4f1e8] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 md:px-8 md:pt-7">
        <header className="border-y-2 border-slate-950 py-4 md:py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="font-serif text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Personlig morgontidning
              </div>
              <h1 className="mt-1 font-serif text-5xl font-black tracking-[-0.04em] md:text-7xl">
                GLENN NEWS
              </h1>
            </div>

            <div className="flex flex-col items-start gap-3 font-serif text-sm md:items-end md:text-right">
              <div className="hidden items-center gap-3 md:flex">
                <a
                  href="/veckofokus"
                  className="border border-slate-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-950 hover:text-slate-950"
                >
                  Veckofokus
                </a>
                <a
                  href="/profil"
                  className="border border-slate-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-950 hover:text-slate-950"
                >
                  Min profil
                </a>
                <a
                  href="/health"
                  className={
                    "inline-flex items-center gap-2 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition " +
                    (feedHealth.totals.errors > 0
                      ? "border-red-600 bg-red-50 text-red-700 hover:border-red-800 hover:text-red-900"
                      : "border-slate-400 text-slate-600 hover:border-slate-950 hover:text-slate-950")
                  }
                >
                  {feedHealth.totals.errors > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                  )}
                  Flödesstatus
                  {feedHealth.totals.errors > 0
                    ? " · " + feedHealth.totals.errors + " fel"
                    : ""}
                </a>
                <ManualRefreshButton />
              </div>
              <div className="md:hidden">
                <ManualRefreshButton />
              </div>
              <div>
                <div className="capitalize font-bold">{formatDate()}</div>
                <div className="mt-1 text-slate-600">
                  Namnsdag:{" "}
                  <span className="font-bold">
                    {dailyHeader.namedays.length > 0
                      ? dailyHeader.namedays.join(", ")
                      : "–"}
                  </span>
                </div>
                {dailyHeader.historicalEvent && (
                  <div className="mt-2 max-w-xl font-serif text-xs leading-5 text-slate-500 md:max-w-md">
                    <span className="font-bold uppercase tracking-[0.12em] text-slate-400">
                      Denna dag i historien · {dailyHeader.historicalEvent.year}
                    </span>
                    <span className="ml-1">
                      {dailyHeader.historicalEvent.text}
                    </span>
                  </div>
                )}
                <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {isFallbackEdition
                    ? "Reservedition från " + formatEditionDate(edition.dateKey)
                      + (formatEditionTimestamp(edition.generatedAt)
                        ? " · skapad " + formatEditionTimestamp(edition.generatedAt)
                        : "")
                    : formatEditionTimestamp(edition.generatedAt)
                      ? "Edition skapad " + formatEditionTimestamp(edition.generatedAt)
                      : "Editionens skapandetid saknas"}
                  {" · "}
                  {totalArticles} artiklar
                </div>
              </div>
            </div>
          </div>
        </header>

        {isFallbackEdition && (
          <section
            role="alert"
            className="mt-4 border-2 border-amber-700 bg-amber-50 px-4 py-3 text-amber-950"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.18em]">
              Reservedition · inte dagens nyhetsurval
            </div>
            <p className="mt-1 font-serif text-sm leading-6">
              Dagens morgonedition ({formatEditionDate(todayDateKey)}) kunde inte skapas.
              Du läser i stället den senaste fungerande editionen från{" "}
              <strong>{formatEditionDate(edition.dateKey)}</strong>. Artiklarna hör till
              det datumet och ska inte tolkas som dagens nyheter.
            </p>
            <RetryMorningEditionButton />
          </section>
        )}

        {isUnavailableEdition && (
          <section
            role="alert"
            className="mt-4 border-2 border-red-700 bg-red-50 px-4 py-3 text-red-950"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.18em]">
              Morgoneditionen är inte tillgänglig
            </div>
            <p className="mt-1 font-serif text-sm leading-6">
              Dagens edition kunde inte skapas, och ingen tidigare fungerande edition
              finns att visa. Du kan försöka skapa dagens upplaga igen.
            </p>
            <RetryMorningEditionButton />
          </section>
        )}

        <div className="flex items-center justify-between border-b border-slate-400 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          <span>
            {isFallbackEdition
              ? "Reservedition · " + formatEditionDate(edition.dateKey)
              : isUnavailableEdition
                ? "Morgoneditionen saknas"
                : "07:01 · Din edition"}
          </span>
          <span><ReaderCount initialCount={profile.totalClicks} /> lästa artiklar · redaktören lär sig</span>
        </div>

        {weather.days.length > 0 && (
          <section className="mt-7 border-y border-slate-300 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                Väder · Borås
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:min-w-[520px]">
                {weather.days.map(day => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between border-l-2 border-slate-950 pl-4"
                  >
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        {day.label}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-2xl" aria-hidden="true">
                          {day.weatherCode === 0 || day.weatherCode === 1
                            ? "☀"
                            : day.weatherCode === 2
                              ? "⛅"
                              : day.weatherCode === 3
                                ? "☁"
                                : day.weatherCode >= 71 && day.weatherCode <= 77
                                  ? "❄"
                                  : day.weatherCode >= 95
                                    ? "⛈"
                                    : "🌧"}
                        </span>
                        <div>
                          <div className="font-serif text-lg font-black">
                            {day.maxTemp}° / {day.minTemp}°
                          </div>
                          <div className="text-xs text-slate-500">
                            {day.description}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs leading-5 text-slate-500">
                      <div>Regnrisk {day.precipitationProbability}%</div>
                      <div>{day.precipitationMm} mm · {day.windKmh} km/h</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="editorial-overview mt-7 border-y-2 border-slate-950 py-5 md:mt-9 md:py-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-800">Glenn News · Överblick på 30 sekunder</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Redaktionens tre viktigaste punkter</div>
          </div>
          <h2 className="mt-3 max-w-5xl font-serif text-3xl font-black leading-[1.08] tracking-[-0.025em] md:text-5xl">
            Det här är viktigast idag.
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.7fr)_minmax(190px,0.55fr)] md:items-start">
            <div className="editorial-highlights grid gap-4 sm:grid-cols-3 sm:gap-5">
              {overviewHighlights.length > 0 ? overviewHighlights.map((highlight, index) => (
                <div key={index} className="border-t-2 border-slate-900 pt-2.5">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-800">
                    0{index + 1} · I korthet
                  </div>
                  <p className="mt-2 font-serif text-sm leading-6 text-slate-700 md:text-[15px] md:leading-6">
                    {highlight}
                  </p>
                </div>
              )) : (
                <p className="font-serif text-sm leading-6 text-slate-600">
                  Dagens viktigaste nyheter och läsvärda fördjupningar, samlade i ett enda redaktionellt flöde.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-300 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <div><div className="font-serif text-3xl font-black tabular-nums">{totalArticles}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Artiklar i underlaget</div></div>
              <div><div className="font-serif text-3xl font-black tabular-nums">{sections.length}</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Bevakningsområden</div></div>
            </div>
          </div>
        </section>

        <section aria-label="Dagens blandade nyhetsflöde" className="mixed-news-grid mt-8">
          {mixedStories.map((entry, index) => {
            const story = entry.story;
            const categoryLabel = entry.categoryKey === "sport"
              ? story.sportGroup ?? "Sport"
              : entry.categoryTitle;
            const variant = index === 0
              ? "lead"
              : index % 9 === 5
                ? "wide"
                : index % 4 === 2
                  ? "compact"
                  : "standard";

            return (
              <div key={String(story.link ?? "") + "-" + entry.categoryKey} className="contents">
                <TrackableLink
                  href={story.link ?? "#"}
                  category={entry.categoryKey}
                  articleType={story.articleType}
                  source={story.source ?? "Okänd källa"}
                  topic={story.topic}
                  summary={story.aiSummary}
                  className={"mixed-news-card mixed-news-card--" + variant + " group"}
                >
                  <div className="mixed-news-card__image">
                    <ArticleImage
                      src={story.image}
                      alt={story.title}
                      priority={index < 2}
                    />
                  </div>
                  <div className="mixed-news-card__content">
                    <div className={"mixed-news-card__eyebrow " + CATEGORY_ACCENTS[entry.categoryKey as keyof typeof CATEGORY_ACCENTS]}>
                      {categoryLabel} · {story.articleType}
                    </div>
                    <h2 className="mixed-news-card__title font-serif font-black group-hover:underline">
                      {story.title}
                    </h2>
                    {story.aiSummary && (
                      <p className="mixed-news-card__summary">
                        {story.aiSummary}
                      </p>
                    )}
                    <div className="mixed-news-card__meta">
                      <span>{story.source ?? "Okänd källa"}</span>
                      <span className="group-hover:text-slate-800">Läs →</span>
                    </div>
                  </div>
                </TrackableLink>

                {(factPanelsByPosition.get(index) ?? []).map(panelIndex => (
                  <div className="mixed-news-interstitial" key={"fact-panel-" + panelIndex}>
                    {panelIndex === 0 && <LocalSnapshotPanel data={localSnapshot} profile={profile} />}
                    {panelIndex === 1 && <NationalSnapshotPanel data={nationalSnapshot} />}
                    {panelIndex === 2 && <WorldSnapshotPanel data={worldSnapshot} />}
                    {panelIndex === 3 && <SportDayPanel data={sportDay} />}
                    {panelIndex === 4 && <MarketDayPanel data={marketDay} />}
                    {panelIndex === 5 && <CultureSnapshotPanel data={cultureSnapshot} />}
                  </div>
                ))}
              </div>
            );
          })}
        </section>

        <section className="pt-1">
          <TrackableLink
            href="/veckofokus"
            category="veckofokus"
            articleType="veckofokus"
            source="Glenn News"
            topic="Veckofokus"
            className={
              "group block border-2 border-slate-950 bg-[#ece7d8] px-5 py-6 transition hover:-translate-y-0.5 hover:bg-white md:px-8 md:py-8 " +
              (isWeekend() ? "shadow-[8px_8px_0_0_#0f172a]" : "")
            }
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-700">
                  {isWeekend() ? "Helgens läsning" : "När veckan är över"}
                </div>
                <h2 className="mt-2 font-serif text-3xl font-black leading-none tracking-[-0.03em] md:text-5xl">
                  {isWeekend() ? "VECKOFOKUS" : "Veckofokus"}
                </h2>
                <p className="mt-3 max-w-2xl font-serif text-base leading-7 text-slate-600 md:text-lg">
                  {isWeekend()
                    ? "Nu har du tid för det som inte behöver läsas direkt. Här hittar du veckans viktigaste och mest läsvärda texter samlade på ett ställe."
                    : "När du har mer tid: veckans viktigaste och mest läsvärda texter samlade på ett ställe."}
                </p>
              </div>
              <div className="shrink-0 text-sm font-bold uppercase tracking-[0.16em] text-slate-500 group-hover:text-slate-950">
                Läs veckofokus →
              </div>
            </div>
          </TrackableLink>
        </section>

        <footer className="pt-6">
          <div className="border-t-2 border-slate-950 pt-4 text-sm leading-6 text-slate-500 md:flex md:justify-between md:gap-8">
            <p>
              Glenn News sparar varje morgonedition så att veckofokus kan
              bygga på det som faktiskt valdes. Din personliga lässtatus
              sparas separat och påverkar kommande redaktionella urval.
            </p>
            <p className="mt-2 md:mt-0 md:text-right">
              Din personliga morgontidning · Glenn News
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
