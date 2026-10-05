import { TrackableLink } from "./components/TrackableLink";
import { createEditorialSection } from "@/lib/editorV2";
import { getArticles } from "@/lib/rss";
import { getReaderProfile } from "@/lib/readerProfile";

export const dynamic = "force-dynamic";

const CATEGORY_CONFIG = [
  {
    key: "elfsborg",
    title: "🔥 Elfsborg",
  },
  {
    key: "boras",
    title: "📍 Lokalt",
  },
  {
    key: "sverige",
    title: "🇸🇪 Sverige",
  },
  {
    key: "varlden",
    title: "🌍 Världen",
  },
  {
    key: "ekonomi",
    title: "💼 Ekonomi",
  },
  {
    key: "fotboll",
    title: "⚽ Fotboll",
  },
  {
    key: "sport",
    title: "🏅 Övrig sport",
  },
  {
    key: "livsstil",
    title: "🎭 Kultur, Mat & Livsstil",
  },
] as const;

const CATEGORY_COLORS = {
  elfsborg: "border-yellow-400",
  boras: "border-orange-400",
  sverige: "border-blue-500",
  varlden: "border-green-500",
  ekonomi: "border-amber-700",
  fotboll: "border-slate-900",
  sport: "border-cyan-500",
  livsstil: "border-pink-500",
} as const;

function formatDate() {
  return new Intl.DateTimeFormat(
    "sv-SE",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(new Date());
}

export default async function Home() {
  const [news, profile] =
    await Promise.all([
      getArticles(),
      getReaderProfile(),
    ]);

  const articleBuckets = {
    ...news,
    sport: [
      ...news.sport,
      ...news.tennis,
    ],
  };

  const sections =
    await Promise.all(
      CATEGORY_CONFIG.map(
        category =>
          createEditorialSection(
            category.key,
            category.title,
            articleBuckets[
              category.key
            ],
            profile
          )
      )
    );

  const totalArticles =
    CATEGORY_CONFIG.reduce(
      (sum, category) =>
        sum +
        articleBuckets[
          category.key
        ].length,
      0
    );

  const elfsborg =
    sections.find(
      section =>
        section.key ===
        "elfsborg"
    );

  const otherSections =
    sections.filter(
      section =>
        section.key !==
        "elfsborg"
    );

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-10">
        <header className="mb-8 md:mb-10">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-orange-500">
                Personlig morgontidning
              </div>
              <h1 className="mt-2 text-5xl md:text-7xl font-black tracking-tight text-slate-950">
                Glenn News
              </h1>
              <p className="mt-3 text-lg md:text-xl text-slate-600">
                {formatDate()} · redigerad för dig
              </p>
            </div>

            <div className="text-sm text-slate-500 md:text-right">
              <div>
                {totalArticles} artiklar
                hittade senaste 24 h
              </div>
              <div className="mt-1">
                {profile.totalClicks} lästa länkar
                har hittills lärt redaktören känna
                dig
              </div>
            </div>
          </div>
        </header>

        {elfsborg && (
          <section className="mb-10 overflow-hidden rounded-3xl border border-yellow-300 bg-white shadow-sm">
            <div className="border-b border-yellow-100 bg-yellow-50 px-6 py-5">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-black text-slate-950">
                    🔥 Elfsborg
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Här filtrerar vi inte bort något.
                    Alla aktuella Elfsborgsartiklar
                    finns kvar.
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-500">
                  {elfsborg.allArticles?.length ?? 0} artiklar
                </span>
              </div>
            </div>

            <div className="divide-y">
              {elfsborg.allArticles?.map(
                (article, index) => (
                  <TrackableLink
                    key={`${article.link}-${index}`}
                    href={
                      article.link ?? "#"
                    }
                    category="elfsborg"
                    articleType={
                      article.articleType
                    }
                    source={
                      article.source ??
                      "Okänd källa"
                    }
                    topic={
                      article.topic
                    }
                    className="flex gap-4 px-6 py-5 transition hover:bg-slate-50"
                  >
                    <div className="w-8 shrink-0 pt-0.5 text-lg font-black text-orange-500">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {article.articleType}
                        {" · "}
                        {article.source}
                      </div>

                      <h3 className="mt-1 text-lg md:text-xl font-bold leading-tight text-slate-950">
                        {article.title}
                      </h3>

                      {article.aiSummary && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {article.aiSummary}
                        </p>
                      )}
                    </div>
                  </TrackableLink>
                )
              )}
            </div>
          </section>
        )}

        <section className="mb-10 rounded-3xl bg-slate-950 px-6 py-7 text-white md:px-8">
          <div className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">
            AI-redaktören
          </div>

          <h2 className="mt-2 text-3xl md:text-4xl font-black">
            Färre nyheter. Bättre läsning.
          </h2>

          <p className="mt-3 max-w-3xl text-base md:text-lg leading-8 text-slate-300">
            Du får redan dagens stora nyheter som
            pushnotiser. Därför sammanfattar Glenn News
            läget kort och väljer sedan två texter per
            område som redaktören bedömer är mest värda
            din tid.
          </p>
        </section>

        <div className="grid gap-8">
          {otherSections.map(
            section => (
              <section
                key={section.key}
                className={`overflow-hidden rounded-3xl border-t-4 bg-white shadow-sm ${CATEGORY_COLORS[section.key as keyof typeof CATEGORY_COLORS]}`}
              >
                <div className="p-6 md:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-2xl md:text-3xl font-black text-slate-950">
                      {section.title}
                    </h2>

                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      2 läsningar
                    </span>
                  </div>

                  {section.summary && (
                    <div className="mt-5 rounded-2xl bg-slate-50 p-5">
                      <div className="text-xs font-bold uppercase tracking-wider text-orange-500">
                        Nyhetsläget
                      </div>

                      <p className="mt-2 text-base md:text-lg leading-8 text-slate-700">
                        {section.summary}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 grid gap-5 md:grid-cols-2">
                    {section.stories.map(
                      (story, index) => (
                        <TrackableLink
                          key={`${story.link}-${index}`}
                          href={
                            story.link ?? "#"
                          }
                          category={
                            section.key
                          }
                          articleType={
                            story.articleType
                          }
                          source={
                            story.source ??
                            "Okänd källa"
                          }
                          topic={
                            story.topic
                          }
                          className="group rounded-2xl border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                        >
                          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-500">
                            <span>
                              #{index + 1}
                            </span>
                            <span>·</span>
                            <span>
                              {story.articleType}
                            </span>
                          </div>

                          <h3 className="mt-3 text-xl md:text-2xl font-black leading-tight text-slate-950 group-hover:text-orange-600">
                            {story.title}
                          </h3>

                          {story.aiSummary && (
                            <p className="mt-3 text-sm md:text-base leading-7 text-slate-600">
                              {story.aiSummary}
                            </p>
                          )}

                          {story.selectionReason && (
                            <div className="mt-5 border-t border-slate-100 pt-4">
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Varför Glenn bör läsa
                              </div>
                              <p className="mt-1 text-sm leading-6 text-slate-600">
                                {story.selectionReason}
                              </p>
                            </div>
                          )}

                          <div className="mt-4 text-xs text-slate-400">
                            {story.source}
                          </div>
                        </TrackableLink>
                      )
                    )}
                  </div>
                </div>
              </section>
            )
          )}
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500">
          Glenn News lär sig av vilka texter du väljer
          att öppna. Enstaka klick ändrar inte hela
          profilen; mönster över tid ska göra redaktören
          bättre.
        </footer>
      </div>
    </main>
  );
}
