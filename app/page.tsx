export const revalidate = 1800;
import { getArticles } from "@/lib/rss";
import { createCategorySummary } from "@/lib/editor";
import { createMorningBrief } from "@/lib/morningBrief";

export default async function Home() {
  const news = await getArticles();

  const categoryConfigs = [
    {
      key: "elfsborg",
      title: "🔥 Elfsborg",
      articles: news.elfsborg,
    },
    {
      key: "boras",
      title: "📍 Borås & Sjuhärad",
      articles: news.boras,
    },
    {
      key: "sverige",
      title: "🇸🇪 Sverige",
      articles: news.sverige,
    },
    {
      key: "varlden",
      title: "🌍 Världen",
      articles: news.varlden,
    },
    {
      key: "ekonomi",
      title: "💼 Ekonomi & Näringsliv",
      articles: news.ekonomi,
    },
    {
      key: "fotboll",
      title: "⚽ Fotboll",
      articles: news.fotboll,
    },
    {
      key: "tennis",
      title: "🎾 Tennis",
      articles: news.tennis,
    },
    {
      key: "sport",
      title: "🏅 Övrig sport",
      articles: news.sport,
    },
    {
      key: "livsstil",
      title: "🎭 Kultur, Mat & Livsstil",
      articles: news.livsstil,
    },
  ];

  const categoryColors = {
    elfsborg: "border-t-4 border-yellow-400",
    boras: "border-t-4 border-orange-400",
    sverige: "border-t-4 border-blue-500",
    varlden: "border-t-4 border-green-500",
    ekonomi: "border-t-4 border-amber-700",
    fotboll: "border-t-4 border-slate-900",
    tennis: "border-t-4 border-purple-500",
    sport: "border-t-4 border-cyan-500",
    livsstil: "border-t-4 border-pink-500",
  };

  const totalArticles = categoryConfigs.reduce(
    (sum, category) => sum + category.articles.length,
    0
  );

  const [morningBrief, summaries] = await Promise.all([
    createMorningBrief(news),

    Promise.all(
      categoryConfigs.map(category =>
        createCategorySummary(
          category.title,
          category.articles
        )
      )
    ),
  ]);

  const categories = categoryConfigs.map(
    (category, index) => ({
      ...category,
      editor: summaries[index],
    })
  );

  const biggestStory =
    categories.find(
      category => category.editor?.mainStory
    )?.editor?.mainStory;

  const latestNews = categories
    .flatMap(category =>
      category.articles
    )
    .sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    )
    .slice(0, 15);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200">
      <div className="max-w-7xl mx-auto px-3 md:px-4 py-6 md:py-8">

        <header className="mb-8">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight">
            Glenn News
          </h1>

          <p className="text-slate-500 text-lg mt-3">
            Din personliga AI-redigerade morgontidning
          </p>

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-500">
            <span>
              {totalArticles} artiklar senaste 24h
            </span>

            <span>
              {new Date().toLocaleDateString("sv-SE")}
            </span>
          </div>
        </header>

        <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 text-white rounded-3xl p-6 md:p-8 shadow-xl mb-10">
          <div className="text-sm uppercase tracking-widest text-slate-300 mb-2">
            ☀️ Morning Brief
          </div>

          <h2 className="text-3xl font-bold mb-4">
            God morgon Glenn
          </h2>

          <div className="leading-7 md:leading-8 text-base md:text-lg whitespace-pre-wrap">
            {morningBrief}
          </div>
        </section>

        {biggestStory && (
          <section className="bg-white rounded-3xl shadow-xl border overflow-hidden mb-10">
            {biggestStory.image && (
              <img
                src={biggestStory.image}
                alt={biggestStory.title}
                className="w-full h-56 md:h-[420px] object-cover"
              />
            )}

            <div className="p-8">
              <div className="text-orange-500 font-bold uppercase tracking-widest mb-3">
                🔥 Dagens största nyhet
              </div>

              <a
                href={biggestStory.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <h2 className="text-3xl md:text-5xl font-black leading-tight text-slate-900 hover:text-blue-600 transition">
                  {biggestStory.title}
                </h2>
              </a>

              <div className="text-slate-500 mt-3">
                {biggestStory.source}
              </div>
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-[320px_1fr] gap-8 items-start">

          <aside className="order-last lg:order-first">
            <section className="bg-white rounded-3xl p-6 border sticky top-4">
              <h2 className="text-2xl font-bold mb-5">
                📰 Senaste nytt
              </h2>

              <div className="space-y-3">
                {latestNews.map(
                  (article, index) => (
                    <a
                      key={index}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border-b pb-3 hover:text-blue-600"
                    >
                      <div className="font-medium text-sm">
                        {article.title}
                      </div>

                      <div className="text-xs text-slate-500 mt-1">
                        {article.source}
                      </div>
                    </a>
                  )
                )}
              </div>
            </section>
          </aside>

          <div className="grid xl:grid-cols-2 gap-8">

            {categories.map(category => (
              <section
                key={category.key}
                className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${
                  categoryColors[
                    category.key as keyof typeof categoryColors
                  ]
                }`}
              >
                <div className="p-6">

                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl md:text-3xl font-bold">
                      {category.title}
                    </h2>

                    <span className="text-sm text-slate-500">
                      {category.articles.length} artiklar
                    </span>
                  </div>

                  {category.editor?.mainStory && (
                    <a
                      href={category.editor.mainStory.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mb-6"
                    >
                      {category.editor.mainStory.image ? (
                        <img
                          src={
                            category.editor.mainStory.image
                          }
                          alt={
                            category.editor.mainStory.title
                          }
                          className="w-full h-48 md:h-64 object-cover rounded-2xl mb-4"
                        />
                      ) : (
                        <div className="w-full h-64 bg-slate-200 rounded-2xl mb-4 flex items-center justify-center">
                          Glenn News
                        </div>
                      )}

                      <div className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">
                        Huvudstory
                      </div>

                      <h3 className="text-xl md:text-2xl font-bold leading-tight text-slate-900 hover:text-blue-600 transition">
                        {category.editor.mainStory.title}
                      </h3>

                      <div className="text-sm text-slate-500 mt-2">
                        {category.editor.mainStory.source}
                      </div>
                    </a>
                  )}

                  {category.editor?.summary && (
                    <div className="bg-slate-50 rounded-2xl p-5 mb-6">
                      <div className="font-semibold mb-2">
                        Lägesbild
                      </div>

                      <p className="text-slate-700 text-sm md:text-base leading-7">
                        {category.editor.summary}
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {category.editor?.topStories?.map(
                      (
                        story: any,
                        index: number
                      ) => (
                        <a
                          key={index}
                          href={story.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex gap-4 border-b last:border-0 pb-4 hover:text-blue-600 transition"
                        >
                          <div className="text-orange-500 font-bold text-xl min-w-[30px]">
                            #{index + 1}
                          </div>

                          <div>
                            <div className="font-medium text-sm md:text-base">
                              {story.title}
                            </div>

                            <div className="text-sm text-slate-500 mt-1">
                              {story.source}
                            </div>
                          </div>
                        </a>
                      )
                    )}
                  </div>

                </div>
              </section>
            ))}

          </div>
        </div>
      </div>
    </main>
  );
}
