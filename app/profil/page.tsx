import {
  getReaderProfile,
  getRecentReaderActivity,
} from "@/lib/readerProfile";
import { getWeeklyReadLinks } from "@/lib/weeklyRead";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  elfsborg: "Elfsborg",
  boras: "Lokalt",
  sverige: "Sverige",
  varlden: "Världen",
  ekonomi: "Ekonomi",
  sport: "Sport",
  livsstil: "Kultur, Mat & Livsstil",
  fotboll: "Fotboll",
  weekfocus: "Veckofokus",
};

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, char => char.toUpperCase());
}

const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

function stockholmParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(value);

  return Object.fromEntries(
    parts
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );
}

function stockholmDateKey(value: Date) {
  const parts = stockholmParts(value);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function shiftDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(year, month - 1, day + days)
  )
    .toISOString()
    .slice(0, 10);
}

function weekdayLabel(dateKey: string) {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TIME_ZONE,
    weekday: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function hourOfDay(value: Date) {
  return Number(stockholmParts(value).hour);
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function formatDate(value: string | null) {
  if (!value) return "–";

  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatRelative(value: string) {
  const minutes = Math.round(
    (Date.now() - new Date(value).getTime()) / 60000
  );

  if (minutes < 2) return "just nu";
  if (minutes < 60) return String(minutes) + " min sedan";

  const hours = Math.round(minutes / 60);
  if (hours < 24) return String(hours) + " h sedan";

  const days = Math.round(hours / 24);
  if (days < 7) return String(days) + " dagar sedan";

  return formatDate(value);
}

function topEntries(
  values: Record<string, number>,
  limit: number
) {
  return Object.entries(values)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function InterestBars({
  entries,
  labels,
  emptyText,
}: {
  entries: Array<[string, number]>;
  labels?: Record<string, string>;
  emptyText: string;
}) {
  const max = entries.length > 0 ? entries[0][1] : 0;

  if (!entries.length) {
    return (
      <p className="font-serif text-base leading-7 text-slate-500">
        {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => {
        const width =
          max > 0
            ? Math.max(6, Math.round((value / max) * 100))
            : 0;

        return (
          <div key={key}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-bold">
                {labels?.[key] ?? pretty(key)}
              </span>
              <span className="text-slate-400">
                {Math.round(value)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden bg-slate-200">
              <div
                className="h-full bg-slate-950"
                style={{ width: String(width) + "%" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Kpi({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note: string;
}) {
  return (
    <div className="border-y border-slate-300 py-4">
      <div className="font-serif text-4xl font-black tracking-[-0.03em]">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-400">
        {note}
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const [profile, activity, weeklyReadLinks] = await Promise.all([
    getReaderProfile(),
    getRecentReaderActivity(50),
    getWeeklyReadLinks(),
  ]);

  const categoryEntries = topEntries(profile.category, 6);
  const articleTypeEntries = topEntries(profile.articleType, 6);
  const sourceEntries = topEntries(profile.source, 8);
  const topicEntries = topEntries(profile.topic, 10);

  const recentActivity = activity;
  const now = Date.now();
  const last7Count = recentActivity.filter(
    item => now - new Date(item.timestamp).getTime() <= 7 * 24 * 60 * 60 * 1000
  ).length;
  const last30Count = recentActivity.filter(
    item => now - new Date(item.timestamp).getTime() <= 30 * 24 * 60 * 60 * 1000
  ).length;

  const todayKey = stockholmDateKey(new Date());
  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const key = shiftDateKey(todayKey, index - 6);
    return {
      key,
      label: weekdayLabel(key),
      count: recentActivity.filter(
        item => stockholmDateKey(new Date(item.timestamp)) === key
      ).length,
    };
  });
  const maxDayCount = Math.max(
    1,
    ...last7Days.map(day => day.count)
  );

  const activityDays = new Set(
    recentActivity.map(item =>
      stockholmDateKey(new Date(item.timestamp))
    )
  );
  let readingStreak = 0;
  while (
    activityDays.has(shiftDateKey(todayKey, -readingStreak))
  ) {
    readingStreak += 1;
  }

  const hourCounts = new Map<number, number>();
  const weekdayCounts = new Map<string, number>();
  for (const item of recentActivity) {
    const date = new Date(item.timestamp);
    const hour = hourOfDay(date);
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);

    const weekday = weekdayLabel(stockholmDateKey(date));
    weekdayCounts.set(
      weekday,
      (weekdayCounts.get(weekday) ?? 0) + 1
    );
  }

  const topHour = [...hourCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  const topWeekday = [...weekdayCounts.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  const sourceTotal = sourceEntries.reduce(
    (sum, [, value]) => sum + value,
    0
  );

  const strongestCategory = categoryEntries[0]
    ? CATEGORY_LABELS[categoryEntries[0][0]] ??
      pretty(categoryEntries[0][0])
    : "–";

  const strongestType = articleTypeEntries[0]
    ? pretty(articleTypeEntries[0][0])
    : null;
  const strongestSource = sourceEntries[0]
    ? pretty(sourceEntries[0][0])
    : null;

  const profileSummary =
    strongestType && strongestSource
      ? "Du läser mest " +
        strongestCategory.toLowerCase() +
        ", med en tydlig dragning mot " +
        strongestType.toLowerCase() +
        " från " +
        strongestSource +
        "."
      : "Mönstret blir tydligare ju mer du läser.";

  return (
    <main className="min-h-screen bg-[#f4f1e8] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 md:px-8 md:pt-7">
        <header className="border-y-2 border-slate-950 py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                Glenn News · Din läsprofil
              </div>
              <h1 className="mt-1 font-serif text-5xl font-black tracking-[-0.04em] md:text-7xl">
                MIN PROFIL
              </h1>
              <p className="mt-3 max-w-3xl font-serif text-lg leading-7 text-slate-600 md:text-xl">
                En överblick över vad du läser, vad du fastnar för och hur Glenn News lär sig din lästid.
              </p>
            </div>
            <div className="text-sm md:text-right">
              <div className="font-bold">Central läshistorik</div>
              <div className="mt-1 text-slate-500">
                Samma profil på mobil och surfplatta
              </div>
              <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                Aktiv
              </div>
            </div>
          </div>
        </header>

        <div className="mt-5 flex items-center justify-between border-b border-slate-400 pb-3">
          <a
            href="/"
            className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 hover:text-slate-950"
          >
            ← Till morgontidningen
          </a>
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Din data · din redaktion
          </span>
        </div>

        <section className="mt-7 grid gap-5 md:grid-cols-4">
          <Kpi
            value={String(profile.totalClicks)}
            label="Lästa artiklar"
            note="Totalt registrerade artikelklick"
          />
          <Kpi
            value={String(weeklyReadLinks.length)}
            label="Veckofokus läst"
            note="Texter du har läst där"
          />
          <Kpi
            value={strongestCategory}
            label="Starkaste område"
            note="Det område som väger tyngst i din profil"
          />
          <Kpi
            value={
              profile.lastUpdated
                ? formatRelative(profile.lastUpdated)
                : "–"
            }
            label="Senaste aktivitet"
            note={
              profile.lastUpdated
                ? formatDate(profile.lastUpdated)
                : "Ingen registrerad ännu"
            }
          />
        </section>

        <section className="mt-9 border-b-2 border-slate-950 pb-9">
          <div className="max-w-4xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-700">
              Din läsprofil
            </div>
            <h2 className="mt-2 font-serif text-3xl font-black md:text-4xl">
              Vad Glenn News tror att du gillar
            </h2>
            <p className="mt-3 font-serif text-lg leading-8 text-slate-600">
              Staplarna visar styrkan i dina lässignaler. De bygger på områden, artikeltyper och källor du återkommer till – inte på vad du borde läsa.
            </p>
          </div>
        </section>

        <div className="mt-9 grid gap-9 lg:grid-cols-2">
          <section className="border-b-2 border-slate-950 pb-9">
            <div className="mb-5 border-b border-slate-300 pb-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
                Områden
              </div>
              <h2 className="mt-1 font-serif text-2xl font-black">
                Vad du läser
              </h2>
            </div>
            <InterestBars
              entries={categoryEntries}
              labels={CATEGORY_LABELS}
              emptyText="Vi behöver några fler läsningar för att se ett mönster."
            />
          </section>

          <section className="border-b-2 border-slate-950 pb-9">
            <div className="mb-5 border-b border-slate-300 pb-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
                Journalistik
              </div>
              <h2 className="mt-1 font-serif text-2xl font-black">
                Vad du fastnar för
              </h2>
            </div>
            <InterestBars
              entries={articleTypeEntries}
              labels={{
                krönika: "Krönika",
                analys: "Analys",
                intervju: "Intervju",
                reportage: "Reportage",
                kommentar: "Kommentar",
                nyhet: "Nyhet",
                notis: "Notis",
                guide: "Guide",
                recension: "Recension",
                övrigt: "Övrigt",
              }}
              emptyText="Artikeltyper börjar synas efter några fler läsningar."
            />
          </section>
        </div>

        <section className="mt-9 grid gap-9 lg:grid-cols-2">
          <section className="border-b-2 border-slate-950 pb-9 lg:col-span-2">
          <div className="mb-5 border-b border-slate-300 pb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
              Just nu
            </div>
            <h2 className="mt-1 font-serif text-2xl font-black">
              Dina hetaste intressen
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              {topicEntries.length ? (
                <div className="flex flex-wrap gap-2">
                  {topicEntries.slice(0, 8).map(([topic, value]) => (
                    <span
                      key={topic}
                      className="border border-slate-400 bg-[#ece7d8] px-3 py-2 text-sm"
                    >
                      {topic}
                      <span className="ml-2 text-xs text-slate-400">
                        {Math.round(value)}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-serif text-base leading-7 text-slate-500">
                  Några fler läsningar behövs innan vi kan se tydliga ämnen.
                </p>
              )}
            </div>

            <div className="border-l-2 border-slate-950 pl-5">
              <div className="font-serif text-lg font-black">
                Så känner Glenn News dig
              </div>
              <p className="mt-2 font-serif text-base leading-7 text-slate-600">
                {profileSummary}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-9 border-b-2 border-slate-950 pb-9">
          <div className="mb-5 border-b border-slate-300 pb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
              Läsvana
            </div>
            <h2 className="mt-1 font-serif text-2xl font-black">
              Din läsning över tid
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Kpi
              value={String(last7Count)}
              label="Senaste 7 dagarna"
              note="Registrerade artikelklick i den senaste veckan"
            />
            <Kpi
              value={String(last30Count)}
              label="Senaste 30 dagarna"
              note="Så mycket av din läsning vi ser i aktuell historik"
            />
            <Kpi
              value={readingStreak ? String(readingStreak) + " dagar" : "–"}
              label="Lässerie"
              note={
                readingStreak
                  ? "Du har läst Glenn News varje dag i serien"
                  : "Öppna en artikel idag för att starta en serie"
              }
            />
          </div>

          <div className="mt-7 grid grid-cols-7 gap-2">
            {last7Days.map(day => (
              <div key={day.key}>
                <div className="flex h-28 items-end border-b border-slate-300">
                  <div
                    className="w-full bg-slate-950"
                    style={{
                      height:
                        day.count > 0
                          ? String(
                              Math.max(
                                10,
                                Math.round(
                                  (day.count / maxDayCount) * 100
                                )
                              )
                            ) + "%"
                          : "3%",
                    }}
                    title={String(day.count) + " lästa"}
                  />
                </div>
                <div className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {day.label}
                </div>
                <div className="mt-1 text-center text-xs text-slate-400">
                  {day.count}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-9 border-b-2 border-slate-950 pb-9">
          <div className="mb-5 border-b border-slate-300 pb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
              Favoriter
            </div>
            <h2 className="mt-1 font-serif text-2xl font-black">
              Där du gärna läser
            </h2>
          </div>

          {sourceEntries.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {sourceEntries.slice(0, 6).map(([source, value]) => (
                <div key={source}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-bold">{pretty(source)}</span>
                    <span className="text-slate-400">
                      {percentage(value, sourceTotal)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden bg-slate-200">
                    <div
                      className="h-full bg-slate-950"
                      style={{
                        width:
                          String(
                            Math.max(
                              4,
                              percentage(value, sourceTotal)
                            )
                          ) + "%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-serif text-base leading-7 text-slate-500">
              Dina favoritkällor börjar synas efter några läsningar.
            </p>
          )}
        </section>

        <section className="mt-9 border-y-2 border-slate-950 py-7">
          <div className="mb-5 border-b border-slate-300 pb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
              Din rytm
            </div>
            <h2 className="mt-1 font-serif text-2xl font-black">
              När du brukar läsa
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="border-l-2 border-slate-950 pl-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Mest aktiv tid
              </div>
              <div className="mt-1 font-serif text-3xl font-black">
                {topHour !== undefined
                  ? String(topHour).padStart(2, "0") + "–" +
                    String((topHour + 1) % 24).padStart(2, "0")
                  : "–"}
              </div>
            </div>
            <div className="border-l-2 border-slate-950 pl-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Mest aktiv veckodag
              </div>
              <div className="mt-1 font-serif text-3xl font-black">
                {topWeekday ?? "–"}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b-2 border-slate-950 pb-9">
            <div className="mb-5 border-b border-slate-300 pb-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
                Källor
              </div>
              <h2 className="mt-1 font-serif text-2xl font-black">
                Där du gärna läser
              </h2>
            </div>
            <InterestBars
              entries={sourceEntries}
              emptyText="Dina favoritkällor börjar synas efter några läsningar."
            />
          </section>

          <section className="border-b-2 border-slate-950 pb-9">
            <div className="mb-5 border-b border-slate-300 pb-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
                Ämnen
              </div>
              <h2 className="mt-1 font-serif text-2xl font-black">
                Återkommande intressen
              </h2>
            </div>

            {topicEntries.length ? (
              <div className="flex flex-wrap gap-2">
                {topicEntries.map(([topic, value]) => (
                  <span
                    key={topic}
                    className="border border-slate-400 bg-[#ece7d8] px-3 py-2 text-sm"
                  >
                    {topic}
                    <span className="ml-2 text-xs text-slate-400">
                      {Math.round(value)}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="font-serif text-base leading-7 text-slate-500">
                När du läser mer börjar återkommande ämnen dyka upp här.
              </p>
            )}
          </section>
        </section>

        <section className="mt-9 border-y-2 border-slate-950 py-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
                Senaste aktivitet
              </div>
              <h2 className="mt-1 font-serif text-3xl font-black">
                Vad du nyligen läste
              </h2>
            </div>
            <div className="text-xs uppercase tracking-[0.14em] text-slate-400">
              {Math.min(activity.length, 20)} senaste registrerade aktiviteter
            </div>
          </div>

          {activity.length ? (
            <div className="mt-6">
              {activity.slice(0, 20).map((item, index) => (
                <div
                  key={[
                    item.timestamp,
                    item.link ?? item.title,
                    String(index),
                  ].join("-")}
                  className="border-b border-slate-300 py-4 last:border-b-0"
                >
                  <div className="grid gap-3 md:grid-cols-[130px_0.22fr_1fr_0.35fr] md:items-start">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      {formatRelative(item.timestamp)}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700">
                      {CATEGORY_LABELS[item.category] ??
                        pretty(item.category)}
                    </div>
                    <div>
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-serif text-lg font-black leading-tight hover:underline"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <div className="font-serif text-lg font-black leading-tight">
                          {item.title}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-slate-500">
                        {item.articleType} · {item.source}
                      </div>
                    </div>
                    <div className="text-xs leading-5 text-slate-500 md:text-right">
                      {item.topic &&
                        item.topic !== item.title &&
                        item.topic}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 border-y border-slate-300 py-10 text-center">
              <div className="font-serif text-2xl font-black">
                Historiken börjar här.
              </div>
              <p className="mx-auto mt-2 max-w-xl font-serif text-base leading-7 text-slate-500">
                När du öppnar artiklar kommer de senaste läsningarna att synas här.
              </p>
            </div>
          )}
        </section>

        <section className="mt-9 border-b-2 border-slate-950 pb-9">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-700">
            Så fungerar din profil
          </div>
          <h2 className="mt-2 font-serif text-3xl font-black md:text-4xl">
            Dina actions påverkar nästa morgon
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <div className="border-l-2 border-slate-950 pl-4">
              <div className="font-serif text-lg font-black">
                01 · Du öppnar
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Glenn News registrerar område, artikeltyp, källa och ämnessignal när du öppnar en text.
              </p>
            </div>
            <div className="border-l-2 border-slate-950 pl-4">
              <div className="font-serif text-lg font-black">
                02 · Mönstret växer
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Återkommande val säger mer än ett enstaka klick.
              </p>
            </div>
            <div className="border-l-2 border-slate-950 pl-4">
              <div className="font-serif text-lg font-black">
                03 · Redaktionen anpassas
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Profilen används för att göra morgonläsningen och Veckofokus mer relevanta.
              </p>
            </div>
          </div>
        </section>

        <footer className="pt-6 text-sm leading-6 text-slate-500 md:flex md:justify-between md:gap-8">
          <p>
            Din läshistorik lagras centralt i Glenn News och följer dig mellan enheter.
          </p>
          <p className="mt-2 md:mt-0 md:text-right">
            Senast uppdaterad {formatDate(profile.lastUpdated)}
          </p>
        </footer>
      </div>
    </main>
  );
}
