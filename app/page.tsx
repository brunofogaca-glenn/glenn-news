import { ManualRefreshButton } from "./components/ManualRefreshButton";
import { TrackableLink } from "./components/TrackableLink";
import { createEditorialSection, createSportEditorialSection } from "@/lib/editorV2";
import { getCachedArticles } from "@/lib/articlesCache";
import { getReaderProfile } from "@/lib/readerProfile";
import { getCachedFeedHealth } from "@/lib/feedHealthCache";

export const dynamic = "force-dynamic";

const CATEGORY_CONFIG = [
  { key: "elfsborg", title: "Elfsborg" },
  { key: "boras", title: "Lokalt" },
  { key: "sverige", title: "Sverige" },
  { key: "varlden", title: "Världen" },
  { key: "ekonomi", title: "Ekonomi" },
  { key: "sport", title: "Sport" },
  { key: "livsstil", title: "Kultur, Mat & Livsstil" },
] as const;

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

function formatDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
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
    <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-200">
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

export default async function Home() {
  const [news, profile, feedHealth] = await Promise.all([
    getCachedArticles(),
    getReaderProfile(),
    getCachedFeedHealth(),
  ]);

  const articleBuckets = {
    ...news,
    sport: [
      ...news.fotboll,
      ...news.sport,
      ...news.tennis,
    ],
  };

  const sections = await Promise.all(
    CATEGORY_CONFIG.map(category =>
      category.key === "sport"
        ? createSportEditorialSection(
            news.fotboll,
            [
              ...news.sport,
              ...news.tennis,
            ],
            profile
          )
        : createEditorialSection(
            category.key,
            category.title,
            articleBuckets[category.key],
            profile
          )
    )
  );

  const totalArticles = CATEGORY_CONFIG.reduce(
    (sum, category) => sum + articleBuckets[category.key].length,
    0
  );

  const elfsborg = sections.find(section => section.key === "elfsborg");
  const otherSections = sections.filter(section => section.key !== "elfsborg");

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
              <div className="flex items-center gap-3">
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
              <div>
                <div className="capitalize font-bold">{formatDate()}</div>
                <div className="mt-1 text-slate-500">
                  {totalArticles} artiklar · dagens 07:01-edition
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex items-center justify-between border-b border-slate-400 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
          <span>07:01 · Din edition</span>
          <span>{profile.totalClicks} lästa länkar · redaktören lär sig</span>
        </div>

        <section className="mt-7 border-b-2 border-slate-950 pb-7 md:mt-9">
          <div className="grid gap-6 md:grid-cols-[1.5fr_0.9fr] md:items-end">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-700">
                Morgonens redaktion
              </div>
              <h2 className="max-w-4xl font-serif text-3xl font-black leading-[1.03] tracking-[-0.025em] md:text-5xl">
                Färre nyheter. Bättre läsning.
              </h2>
            </div>
            <p className="font-serif text-base leading-7 text-slate-600 md:text-lg">
              Glenn News sammanfattar nyhetsläget och väljer ut det som
              faktiskt är värt din tid. Krönikor, analyser, intervjuer och
              reportage väger tyngre än ännu en kort nyhetsnotis.
            </p>
          </div>
        </section>

        {elfsborg && (
          <section className="mt-8 border-b-2 border-slate-950 pb-9">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-300 pb-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow-700">
                  Full bevakning
                </div>
                <h2 className="font-serif text-3xl font-black md:text-4xl">
                  {elfsborg.title}
                </h2>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {elfsborg.allArticles?.length ?? 0} artiklar
              </span>
            </div>

            {elfsborg.allArticles?.[0] && (
              <TrackableLink
                href={elfsborg.allArticles[0].link ?? "#"}
                category="elfsborg"
                articleType={elfsborg.allArticles[0].articleType}
                source={elfsborg.allArticles[0].source ?? "Okänd källa"}
                topic={elfsborg.allArticles[0].topic}
                className="group block border-b border-slate-300 pb-7"
              >
                <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="overflow-hidden bg-slate-200">
                    <ArticleImage
                      src={elfsborg.allArticles[0].image}
                      alt={elfsborg.allArticles[0].title}
                      priority
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">
                      {elfsborg.allArticles[0].articleType} · {elfsborg.allArticles[0].source}
                    </div>
                    <h3 className="mt-3 font-serif text-3xl font-black leading-[1.05] tracking-[-0.02em] md:text-4xl">
                      {elfsborg.allArticles[0].title}
                    </h3>
                    {elfsborg.allArticles[0].aiSummary && (
                      <p className="mt-4 font-serif text-base leading-7 text-slate-600">
                        {elfsborg.allArticles[0].aiSummary}
                      </p>
                    )}
                    <div className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-700">
                      Läs artikeln →
                    </div>
                  </div>
                </div>
              </TrackableLink>
            )}

            <div className="mt-6 grid gap-x-6 md:grid-cols-2">
              {elfsborg.allArticles?.slice(1).map((article, index) => (
                <TrackableLink
                  key={String(article.link ?? "") + "-" + String(index + 1)}
                  href={article.link ?? "#"}
                  category="elfsborg"
                  articleType={article.articleType}
                  source={article.source ?? "Okänd källa"}
                  topic={article.topic}
                  className="group flex gap-4 border-b border-slate-300 py-4"
                >
                  <div className="w-7 shrink-0 pt-0.5 text-sm font-bold text-yellow-700">
                    {index + 2}
                  </div>
                  {article.image && (
                    <div className="h-20 w-28 shrink-0 overflow-hidden bg-slate-200">
                      <img
                        src={article.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                      {article.articleType} · {article.source}
                    </div>
                    <h3 className="mt-1 font-serif text-lg font-bold leading-tight group-hover:underline">
                      {article.title}
                    </h3>
                  </div>
                </TrackableLink>
              ))}
            </div>
          </section>
        )}

        <div className="mt-9 grid gap-9">
          {otherSections.map(section => (
            <section
              key={section.key}
              className="border-b-2 border-slate-950 pb-9"
            >
              <div className="mb-4 flex items-end justify-between gap-4 border-b border-slate-300 pb-2">
                <div>
                  <div
                    className={"text-[10px] font-bold uppercase tracking-[0.22em] " + CATEGORY_ACCENTS[section.key as keyof typeof CATEGORY_ACCENTS]}
                  >
                    Glenn News · Redaktionen
                  </div>
                  <h2 className="font-serif text-3xl font-black md:text-4xl">
                    {section.title}
                  </h2>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {section.key === "sport"
                    ? "6 texter · 4 fotboll · 2 övrig sport"
                    : "4 texter"}
                </span>
              </div>

              {section.summary && (
                <div className="grid gap-5 border-b border-slate-300 pb-6 md:grid-cols-[0.22fr_1fr]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Nyhetsläget
                  </div>
                  <p className="max-w-4xl font-serif text-lg leading-8 text-slate-800 md:text-xl">
                    {section.summary}
                  </p>
                </div>
              )}

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {section.stories.map((story, index) => (
                  <div
                    key={String(story.link ?? "") + "-" + String(index)}
                    className="contents"
                  >
                    {section.key === "sport" && index === 4 && (
                      <div className="col-span-full mt-3 border-y border-slate-300 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700">
                        Övrig sport · 2 texter
                      </div>
                    )}

                    <TrackableLink
                      href={story.link ?? "#"}
                      category={section.key}
                      articleType={story.articleType}
                      source={story.source ?? "Okänd källa"}
                      topic={story.topic}
                      className="group overflow-hidden border-b border-slate-300 pb-6"
                    >
                      <div className="overflow-hidden bg-slate-200">
                        <ArticleImage
                          src={story.image}
                          alt={story.title}
                        />
                      </div>

                      <div className="pt-4">
                        <div
                          className={"text-[10px] font-bold uppercase tracking-[0.18em] " + CATEGORY_ACCENTS[section.key as keyof typeof CATEGORY_ACCENTS]}
                        >
                          {section.key === "sport"
                            ? story.sportGroup
                            : index === 0
                              ? "Dagens läsning"
                              : "Också läsvärd"}{" "}
                          · {story.articleType}
                        </div>

                        <h3 className="mt-2 font-serif text-2xl font-black leading-tight tracking-[-0.015em] md:text-3xl group-hover:underline">
                          {story.title}
                        </h3>

                        {story.aiSummary && (
                          <p className="mt-3 font-serif text-base leading-7 text-slate-600">
                            {story.aiSummary}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                          <span>{story.source}</span>
                          <span className="group-hover:text-slate-700">
                            Läs →
                          </span>
                        </div>
                      </div>
                    </TrackableLink>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="pt-6">
          <div className="border-t-2 border-slate-950 pt-4 text-sm leading-6 text-slate-500 md:flex md:justify-between md:gap-8">
            <p>
              Glenn News lär sig av vilka texter du öppnar. Enstaka klick
              ändrar inte hela profilen; mönster över tid gör redaktören
              bättre.
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
