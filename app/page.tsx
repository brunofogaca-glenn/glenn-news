export const revalidate = 1900;
import { getArticles } from "@/lib/rss";
import { createCategorySummary } from "@/lib/editor";

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

const summaries = await Promise.all(
  categoryConfigs.map(category =>
    createCategorySummary(
      category.title,
      category.articles
    )
  )
);
  
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
  .filter(
    (
      article,
      index,
      self
    ) =>
      index ===
      self.findIndex(
        a =>
          a.title
            .toLowerCase()
            .slice(0, 40) ===
          article.title
            .toLowerCase()
            .slice(0, 40)
      )
  )
  .sort(
    (a, b) =>
      new Date(
        b.date
      ).getTime() -
      new Date(
        a.date
      ).getTime()
  )
  .slice(0, 15);

const frontPageFeed = categories
  .flatMap(category => [
    ...(category.editor?.mainStory
      ? [{
          ...category.editor.mainStory,
          category: category.title,
        }]
      : []),

    ...(category.editor?.topStories ?? []).map((story: any) => ({
      ...story,
      category: category.title,
    })),
  ])
  .filter(
    (article, index, self) =>
      index ===
      self.findIndex(
        a =>
          a.title.toLowerCase().slice(0, 40) ===
          article.title.toLowerCase().slice(0, 40)
      )
  );

const usedCategories = new Set<string>();

const topStories = frontPageFeed
  .filter(article => article.link !== biggestStory?.link)
  .filter(article => {
    if (usedCategories.has(article.category)) {
      return false;
    }

    usedCategories.add(article.category);
    return true;
  })
  .slice(0, 8);

  const articleFeed = frontPageFeed
  .filter(article => article.link !== biggestStory?.link)
  .slice(8, 150);
  
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

        {biggestStory && (
          <section className="bg-white rounded-3xl shadow-xl border overflow-hidden mb-10">
            {biggestStory.image && (
              <img
                src={biggestStory.image}
                alt={biggestStory.title}
                className="w-full h-56 md:h-[320px] object-cover"
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

{(biggestStory as any).aiSummary && (
  <p className="text-lg text-slate-700 mt-4 leading-8">
    {(biggestStory as any).aiSummary}
  </p>
)}

<div className="text-slate-500 mt-4">
  {biggestStory.source}

  {(biggestStory as any).mentions > 1 && (
    <span className="ml-2 text-orange-500 font-medium">
      🔥 {(biggestStory as any).mentions} källor
    </span>
  )}
</div>
              <div className="mt-8 grid md:grid-cols-3 gap-4">

  {latestNews
  .filter(article => article.link !== biggestStory.link)
  .slice(0,3)
  .map((article,index)=>(

    <a
      key={index}
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="border-t pt-4 hover:text-blue-600 transition"
    >

      <div className="text-xs uppercase text-slate-500 mb-2">
        {article.source}
      </div>

      <div className="font-semibold leading-snug">
        {article.title}
      </div>

    </a>

  ))}

</div>
            </div>
          </section>
        )}
<section className="mb-10">

  <h2 className="text-3xl font-black mb-6">
    📰 Dagens viktigaste
  </h2>

  <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">

    {topStories.map((story: any, index: number) => (

  <a
    key={index}
    href={story.link}
    target="_blank"
    rel="noopener noreferrer"
    className={
      index === 0
        ? "md:col-span-2 bg-white rounded-2xl overflow-hidden border hover:shadow-xl transition"
        : "bg-white rounded-2xl overflow-hidden border hover:shadow-xl transition"
    }
  >


        {story.image && (

          <img
            src={story.image}
            alt={story.title}
            className={
  index === 0
    ? "w-full h-64 object-cover"
    : "w-full h-40 object-cover"
}
          />

        )}

        <div className="p-4">

          <div className="text-xs uppercase text-orange-500 font-bold mb-2">
            {story.category}
          </div>

          <div className="font-bold leading-snug">
            {story.title}
          </div>

        </div>

      </a>

    ))}

  </div>

</section>
               
<section className="mt-10">
  <h2 className="text-3xl font-black mb-6">
    Fortsätt läsa
  </h2>

  <div className="grid md:grid-cols-2 gap-5">
    {articleFeed.map((story: any, index: number) => (
      <a
        key={index}
        href={story.link}
        target="_blank"
        rel="noopener noreferrer"
        className={`bg-white rounded-2xl border hover:shadow-lg transition overflow-hidden ${
  index % 7 === 0
    ? "md:col-span-2"
    : ""
}`}
      >
        {story.image && (
          <img
            src={story.image}
            className="w-32 h-24 rounded-xl object-cover flex-shrink-0"
          />
        )}

        <div>
          <div className="text-xs uppercase text-orange-500 font-bold mb-1">
            {story.category}
          </div>

          <div className="font-bold">
            {story.title}
          </div>

          {story.aiSummary && (
            <div className="text-sm text-slate-600 mt-2 line-clamp-2">
              {story.aiSummary}
            </div>
          )}
        </div>
      </a>
    ))}
 </div>
</section>

        </div>
    </main>
  );
}
