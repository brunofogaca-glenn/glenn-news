import type { ReactNode } from "react";
import type {
  CultureSnapshot,
  LocalSnapshot,
  NationalSnapshot,
  WorldSnapshot,
} from "@/lib/dailySnapshots";
import type { ReaderProfile } from "@/lib/readerProfile";

function SourceLink({ title, url }: { title: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-slate-300 underline-offset-2 transition hover:text-slate-950"
    >
      {title}
    </a>
  );
}

function SourceFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 border-t border-slate-300 pt-2 text-[9px] uppercase tracking-[0.12em] text-slate-400">
      {children}
    </div>
  );
}

function formatFetchedAt(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Hämtningstid saknas";
  return "Hämtad " + new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function SmallEntry({
  item,
  meta,
}: {
  item: { title: string; url: string; dateLabel?: string; time?: string; description?: string; venue?: string; image?: string };
  meta?: string;
}) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 border-b border-slate-200 py-3 last:border-b-0"
    >
      <div className="w-[76px] shrink-0 pt-0.5 text-[10px] font-bold uppercase leading-4 tracking-[0.08em] text-slate-500">
        {item.dateLabel ?? meta ?? "Aktuellt"}
        {item.time ? <div className="mt-0.5 font-mono text-[11px] tracking-normal text-slate-700">{item.time}</div> : null}
      </div>
      <div className="min-w-0 flex-1">
        {item.venue ? <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{item.venue}</div> : null}
        <div className="font-serif font-bold leading-snug group-hover:underline">{item.title}</div>
        {item.description ? <div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div> : null}
      </div>
      {item.image ? <img src={item.image} alt="" loading="lazy" className="h-12 w-16 shrink-0 self-center rounded-sm object-cover" /> : null}
    </a>
  );
}

function normalizeInterestText(value: string) {
  return value
    .toLocaleLowerCase("sv-SE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function localEventBaseScore(item: LocalSnapshot["events"][number]) {
  const text = normalizeInterestText(item.title + " " + (item.description ?? ""));

  // Treat a full organ-festival programme as one niche series, not as several competing "music" picks.
  if (/orgel|orgelimprovisation|rorelsemeditation/.test(text)) return 12;
  if (/\belfsborg\b|\ballsvenskan\b|\bfotboll\b|\bfootball\b/.test(text)) return 120;
  if (/boras basket|\bbasket\b|\bishockey\b|\bhockey\b|\bfotboll\b|\bgolf\b/.test(text)) return 105;
  if (/sven ingvars|eva dahlgren|carola|konsert|konserten|\bturne\b|\blive\b|\bmusikkar\b|\bartist\b|\bmusik\b/.test(text)) return 92;
  if (/stand ?up|komiker|humor|shan anci|teater|musikal|scenforestallning|\bshow\b/.test(text)) return 86;
  if (/halloween|djurpark|festival|matmarknad|julmarknad|\bmassa\b/.test(text)) return 72;
  if (/orgel|orgelimprovisation|rorelsemeditation|\byoga\b|\bworkshop\b|\bkurs\b/.test(text)) return 12;
  return 34;
}

function interestAliasMatches(term: string, eventText: string) {
  const key = normalizeInterestText(term);
  if (key.length < 4) return false;
  if (eventText.includes(key)) return true;

  if (/elfsborg|allsvenskan|fotboll|football/.test(key)) {
    return /elfsborg|allsvenskan|fotboll|football|boras arena/.test(eventText);
  }
  if (/basket/.test(key)) return /\bbasket\b|boras basket/.test(eventText);
  if (/hockey/.test(key)) return /hockey|ishockey/.test(eventText);
  if (/musik|music|konsert|artist/.test(key)) {
    return /konsert|turne|live|musik|artist|sven ingvars|eva dahlgren|carola|spelning/.test(eventText);
  }
  if (/stand ?up|komedi|humor|komiker/.test(key)) {
    return /stand ?up|komiker|humor|shan anci|\bshow\b/.test(eventText);
  }
  if (/teater|musikal|scen/.test(key)) return /teater|musikal|scenforestallning/.test(eventText);
  if (/\bsport\b/.test(key)) {
    return /elfsborg|fotboll|basket|hockey|ishockey|golf|sport|match/.test(eventText);
  }
  return false;
}

function getProfileInterestBoost(item: LocalSnapshot["events"][number], profile: ReaderProfile) {
  const text = normalizeInterestText(item.title + " " + (item.description ?? ""));
  const maps: Array<{ values?: Record<string, number>; multiplier: number }> = [
    { values: profile.entity, multiplier: 0.28 },
    { values: profile.semanticTopic, multiplier: 0.24 },
    { values: profile.semanticTag, multiplier: 0.20 },
    { values: profile.topic, multiplier: 0.14 },
    { values: profile.semanticCategory, multiplier: 0.12 },
    { values: profile.category, multiplier: 0.08 },
  ];

  let boost = 0;
  for (const { values, multiplier } of maps) {
    const interests = Object.entries(values ?? {})
      .filter(([term, weight]) => normalizeInterestText(term).length >= 4 && Number.isFinite(weight) && weight > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16);

    for (const [term, weight] of interests) {
      if (interestAliasMatches(term, text)) {
        boost += Math.min(12, Math.max(2, weight * multiplier));
      }
    }
  }
  return Math.min(36, boost);
}

function localEventSeriesKey(item: LocalSnapshot["events"][number]) {
  const text = normalizeInterestText(item.title + " " + (item.description ?? ""));
  if (/boras orgelfestival|orgel|orgelimprovisation|rorelsemeditation/.test(text)) return "orgelfestival";
  if (/halloween pa boras djurpark/.test(text)) return "halloween-boras-djurpark";
  return normalizeInterestText(item.title);
}

function rankLocalEvents(events: LocalSnapshot["events"], profile: ReaderProfile) {
  const ranked = events
    .map(item => ({
      item,
      score: localEventBaseScore(item) + getProfileInterestBoost(item, profile),
    }))
    .sort((a, b) =>
      b.score - a.score ||
      (a.item.date ?? "").localeCompare(b.item.date ?? "") ||
      (a.item.time ?? "99:99").localeCompare(b.item.time ?? "")
    );

  const selected: LocalSnapshot["events"] = [];
  const seenSeries = new Set<string>();
  for (const candidate of ranked) {
    const series = localEventSeriesKey(candidate.item);
    if (seenSeries.has(series)) continue;
    seenSeries.add(series);
    selected.push(candidate.item);
    if (selected.length >= 8) break;
  }
  return selected;
}

export function LocalSnapshotPanel({ data, profile }: { data: LocalSnapshot; profile: ReaderProfile }) {
  const selectedEvents = rankLocalEvents(data.events, profile).slice(0, 4);
  return (
    <section className="border-y border-slate-300 bg-[#f0eadf] px-4 py-4 md:px-5 md:py-5">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-300 pb-3 sm:flex-row sm:items-end">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-orange-800">Borås · kalendern</div>
          <h3 className="mt-1 font-serif text-xl font-black md:text-2xl">Händer i närtid – utvalt för dig</h3>
          <p className="mt-1 text-xs text-slate-500">
            {data.eventSource === "boras-stad-fallback"
              ? "Borås.com-listan gick inte att läsa just nu. Tillfälligt reservurval från Borås Stads evenemang, prioriterat efter dina intressen."
              : "Evenemang från Borås.com, prioriterade efter dina läsintressen."} Kommunala sammanträden visas separat.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {data.sources.map(source => <SourceLink key={source.url} {...source} />)}
        </div>
      </div>

      <div className="mt-3 grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Evenemang för dig</div>
          {selectedEvents.length ? (
            selectedEvents.map((item, index) => <SmallEntry key={item.url + item.date + index} item={item} />)
          ) : (
            <p className="py-3 font-serif text-sm text-slate-500">
              Inga kommande evenemang hittades i Borås.com just nu. Öppna kalendern för hela utbudet.
            </p>
          )}
        </div>
        <div className="border-t border-slate-300 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Kommunen · nästa sammanträden</div>
          {data.meetings.length ? (
            data.meetings.slice(0, 3).map((item, index) => <SmallEntry key={item.date + item.title + index} item={item} />)
          ) : (
            <p className="py-3 font-serif text-sm text-slate-500">Inga kommande sammanträden hittades i kalendern.</p>
          )}
        </div>
      </div>
      <SourceFooter>
        <span>{formatFetchedAt(data.updatedAt)}</span>
        <span>
          {data.eventSource === "boras-stad-fallback"
            ? " · Evenemang: Borås Stad (reservkälla) · sammanträden: Borås Stad"
            : " · Evenemang: Borås.com · sammanträden: Borås Stad"}
        </span>
      </SourceFooter>
    </section>
  );
}

export function NationalSnapshotPanel({ data }: { data: NationalSnapshot }) {
  return (
    <section className="border-y border-slate-300 bg-[#e8edf2] px-4 py-4 md:px-5 md:py-5">
      <div className="flex flex-col justify-between gap-2 border-b border-slate-300 pb-3 sm:flex-row sm:items-end">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-800">Sverige · riksdagen</div>
          <h3 className="mt-1 font-serif text-xl font-black md:text-2xl">På den politiska dagordningen</h3>
          <p className="mt-1 text-xs text-slate-500">Kommande planerade kammardagar och senaste informationen från riksdagen.</p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {data.sources.map(source => <SourceLink key={source.url} {...source} />)}
        </div>
      </div>

      <div className="mt-3 grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Planerade ärenden</div>
          {data.agenda.length ? (
            data.agenda.slice(0, 4).map((item, index) => <SmallEntry key={(item.date ?? "") + item.title + index} item={item} />)
          ) : (
            <p className="py-3 font-serif text-sm text-slate-500">Planerade ärenden kunde inte läsas in just nu.</p>
          )}
        </div>
        <div className="border-t border-slate-300 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Riksdagen just nu</div>
          {data.news.length ? (
            data.news.slice(0, 3).map((item, index) => <SmallEntry key={item.url + index} item={item} />)
          ) : (
            <p className="py-3 font-serif text-sm text-slate-500">Senaste nytt kunde inte hämtas just nu.</p>
          )}
        </div>
      </div>
      <SourceFooter>
        <span>{formatFetchedAt(data.updatedAt)}</span>
        <span> · Källa: Sveriges riksdag</span>
      </SourceFooter>
    </section>
  );
}

function signedPercent(value: number) {
  return (value > 0 ? "+" : "") + value.toFixed(2).replace(".", ",") + "%";
}

function formatMarketValue(value: number, unit: string) {
  const formatted = new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: unit === "index" ? 2 : 3,
    minimumFractionDigits: 0,
  }).format(value);
  return unit === "USD/fat" ? formatted + " $" : unit === "SEK" ? formatted + " kr" : formatted;
}

export function WorldSnapshotPanel({ data }: { data: WorldSnapshot }) {
  const latestMarketDate = data.markets.map(item => item.date).sort().at(-1);
  const worldDataStale = data.refreshMeta?.status === "stale";

  return (
    <section className="border-y border-slate-300 bg-[#e7ece5] px-4 py-4 md:px-5 md:py-5">
      {worldDataStale ? (
        <div role="status" className="mb-4 border-l-2 border-amber-700 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <div className="font-bold">Världsdata använder senast fungerande snapshot</div>
          <p className="mt-1">{data.refreshMeta?.lastError ?? "En eller flera marknadsobservationer är inaktuella."}</p>
        </div>
      ) : null}
      <div className="flex flex-col justify-between gap-2 border-b border-slate-300 pb-3 sm:flex-row sm:items-end">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-800">Världen · globala indikatorer</div>
          <h3 className="mt-1 font-serif text-xl font-black md:text-2xl">Världsläget i siffror</h3>
          <p className="mt-1 text-xs text-slate-500">Marknadens senaste stängning och senast rapporterade makrotal.</p>
        </div>
        <div className="text-xs text-slate-500">Olja · valutor · risk · räntor · BNP</div>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Marknader · senaste tillgängliga stängning</div>
        {data.markets.length ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {data.markets.map(item => {
              const brentLagging = item.symbol === "BZ=F" && Boolean(latestMarketDate) && item.date < latestMarketDate!;
              return (
              <a key={item.symbol} href={item.url} target="_blank" rel="noreferrer" className="border-l-2 border-slate-950 pl-3 transition hover:bg-white/30">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">{item.name}</div>
                <div className="mt-1 font-serif text-lg font-black tabular-nums">{formatMarketValue(item.value, item.unit)}</div>
                {item.changePct !== undefined ? (
                  <div className={"mt-0.5 text-xs font-bold tabular-nums " + (item.changePct > 0 ? "text-emerald-700" : item.changePct < 0 ? "text-red-700" : "text-slate-500")}>
                    {signedPercent(item.changePct)}
                  </div>
                ) : null}
                <div className="mt-1 text-[9px] text-slate-400">{item.date}</div>
                <div className="mt-0.5 text-[9px] text-slate-400">{item.source}</div>
                {brentLagging ? (
                  <div className="mt-1 text-[9px] font-bold text-amber-800">Observationsdatum släpar</div>
                ) : null}
              </a>
              );
            })}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Marknadsdata kunde inte hämtas just nu.</p>
        )}
      </div>

      <div className="mt-5 grid gap-5 border-t border-slate-300 pt-4 md:grid-cols-[0.95fr_1.05fr]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Centralbankernas räntor</div>
          {data.rates.length ? (
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              {data.rates.map(rate => (
                <a key={rate.name} href={rate.url} target="_blank" rel="noreferrer" className="border-b border-slate-200 pb-2 last:border-b-0">
                  <div className="text-xs text-slate-500">{rate.name}</div>
                  <div className="mt-0.5 font-serif text-xl font-black tabular-nums">{rate.value.toLocaleString("sv-SE", { maximumFractionDigits: 2 })}%</div>
                  <div className="text-[10px] text-slate-500">{rate.detail}</div>
                  <div className="mt-0.5 text-[9px] text-slate-400">{rate.date}</div>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Ränteuppgifter kunde inte hämtas just nu.</p>
          )}
        </div>

        <div className="border-t border-slate-300 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">BNP-tillväxt · senaste årsutfall</div>
          {data.gdp.length ? (
            <div className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              {data.gdp.map(item => (
                <div key={item.code} className="border-b border-slate-200 py-2">
                  <div className="text-xs text-slate-500">{item.country}</div>
                  <div className={"mt-0.5 font-serif text-lg font-black tabular-nums " + (item.value > 0 ? "text-emerald-800" : item.value < 0 ? "text-red-700" : "text-slate-800")}>
                    {signedPercent(item.value)}
                  </div>
                  <div className="text-[9px] text-slate-400">{item.year} · World Bank</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">BNP-jämförelsen kunde inte hämtas just nu.</p>
          )}
        </div>
      </div>

      <SourceFooter>
        <span>{formatFetchedAt(data.updatedAt)}</span>
        <span>Källor: Yahoo Finance · Riksbanken · FRED · World Bank</span>
        {data.warnings.length ? <span> · Vissa delkällor svarade inte</span> : null}
        <span> · BNP publiceras årsvis; marknadsdata kan släpa efter.</span>
      </SourceFooter>
    </section>
  );
}

export function CultureSnapshotPanel({ data }: { data: CultureSnapshot }) {
  return (
    <section className="border-y border-slate-300 bg-[#f1e6eb] px-4 py-4 md:px-5 md:py-5">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="border-b border-slate-300 pb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-pink-800">Kultur · film</div>
            <h3 className="mt-1 font-serif text-xl font-black md:text-2xl">Senaste filmrecensionerna</h3>
            <p className="mt-1 text-xs text-slate-500">Nya filmrecensioner från Dagens Nyheter.</p>
            <div className="mt-2 text-xs text-slate-500">
              <SourceLink title="DN:s RSS-flöde" url={data.filmReviewSourceUrl} />
            </div>
          </div>

          {data.filmReviews.length ? (
            <div className="mt-1">
              {data.filmReviews.slice(0, 6).map((review, index) => (
                <SmallEntry key={review.url + index} item={review} meta="Filmrecension" />
              ))}
            </div>
          ) : (
            <p className="mt-3 font-serif text-sm text-slate-500">
              Filmrecensionerna kunde inte hämtas just nu. Prova igen senare.
            </p>
          )}
        </div>

        <div className="min-w-0 border-t border-slate-300 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="border-b border-slate-300 pb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-pink-800">Kultur · musik</div>
            <h3 className="mt-1 font-serif text-xl font-black md:text-2xl">Senaste skivrecensionerna</h3>
            <p className="mt-1 text-xs text-slate-500">Nya albumrecensioner från Dagens Nyheter.</p>
            <div className="mt-2 text-xs text-slate-500">
              <SourceLink title="DN:s RSS-flöde" url={data.albumReviewSourceUrl} />
            </div>
          </div>

          {data.albumReviews.length ? (
            <div className="mt-1">
              {data.albumReviews.slice(0, 6).map((review, index) => (
                <SmallEntry key={review.url + index} item={review} meta="Skivrecension" />
              ))}
            </div>
          ) : (
            <p className="mt-3 font-serif text-sm text-slate-500">
              Skivrecensionerna kunde inte hämtas just nu. Prova igen senare.
            </p>
          )}
        </div>
      </div>

      <SourceFooter>
        <span>{formatFetchedAt(data.updatedAt)}</span>
        <span> · Källor: DN:s film- och skivrecensioner</span>
      </SourceFooter>
    </section>
  );
}

