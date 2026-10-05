import OpenAI from "openai";
import { rankArticles } from "./ranker";
import { getArticles, type Article } from "./rss";
import type { ReaderProfile } from "./readerProfile";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type WeeklyStory = Article & {
  id: number;
  articleType: string;
  aiSummary: string;
  selectionReason: string;
};

export type WeeklyFocus = {
  title: string;
  summary: string;
  stories: WeeklyStory[];
  periodStart: string;
  periodEnd: string;
};

function inferArticleType(article: Article) {
  if (article.articleType) return article.articleType;

  const text = (article.title + " " + (article.description ?? "")).toLowerCase();

  if (/krönika|krönikor|krönikör|kolumn/.test(text)) return "krönika";
  if (/analys|expert|bedömer|därför/.test(text)) return "analys";
  if (/intervju|intervjuar|säger till/.test(text)) return "intervju";
  if (/reportage|på plats|möter|berättar/.test(text)) return "reportage";
  if (/kommentar|ledare|opinion/.test(text)) return "kommentar";
  if (/recension|recenserar|betyg/.test(text)) return "recension";
  if (/guide|tips|så fungerar/.test(text)) return "guide";
  if (/notis|i korthet/.test(text)) return "notis";

  return "nyhet";
}

function articleCategory(article: Article) {
  const text = (article.title + " " + (article.description ?? "")).toLowerCase();

  if (/elfsborg|if elfsborg|guligan/.test(text)) return "elfsborg";
  if (/borås|sjuhärad|frista/.test(text)) return "lokalt";
  if (/regeringen|riksdagen|sverige|socialdemokrat|vänsterpart/.test(text)) return "sverige";
  if (/ukraina|ryssland|trump|usa|kina|gaza|iran|israel|nato/.test(text)) return "världen";
  if (/börs|ränta|inflation|riksbanken|bolån|ekonomi|cervenka/.test(text)) return "ekonomi";
  if (/fotboll|allsvenskan|premier league|champions league|tennis|skidor/.test(text)) return "sport";

  return "kultur, mat & livsstil";
}

function buildWeeklyCandidates(articles: Article[], readLinks: Set<string>) {
  const unread = articles.filter(article => article.link && !readLinks.has(article.link));
  const ranked = rankArticles(unread);

  const byNews = [...ranked].sort((a, b) =>
    (b.newsScore ?? b.score ?? 0) - (a.newsScore ?? a.score ?? 0)
  );

  const byReading = [...ranked].sort(
    (a, b) => (b.readingScore ?? 0) - (a.readingScore ?? 0)
  );

  const preferred = new Set(["krönika", "analys", "intervju", "reportage", "kommentar", "recension"]);
  const selected: Array<ReturnType<typeof rankArticles>[number]> = [];
  const seen = new Set<string>();

  function add(article: ReturnType<typeof rankArticles>[number]) {
    const key = article.link || article.title;
    if (seen.has(key)) return;
    seen.add(key);
    selected.push(article);
  }

  byReading.slice(0, 30).forEach(add);
  byNews.slice(0, 30).forEach(add);
  ranked.filter(article => preferred.has(inferArticleType(article))).slice(0, 25).forEach(add);
  ranked.slice(0, 20).forEach(add);

  return selected.slice(0, 60).map((article, index) => ({
    id: index,
    title: article.title,
    description: article.description ?? "",
    source: article.source ?? "Okänd källa",
    category: articleCategory(article),
    link: article.link ?? "",
    image: article.image ?? null,
    date: article.date ?? "",
    newsScore: article.newsScore ?? article.score ?? 0,
    readingScore: article.readingScore ?? 0,
    mentions: article.mentions ?? 1,
    uniqueSources: article.uniqueSources ?? 1,
    topic: article.topic ?? article.title,
    articleType: inferArticleType(article),
  }));
}

function profileForPrompt(profile: ReaderProfile) {
  return {
    totalClicks: profile.totalClicks,
    category: profile.category,
    articleType: profile.articleType,
    source: profile.source,
    topic: profile.topic,
  };
}

export async function createWeeklyFocus(profile: ReaderProfile, readLinks: string[]): Promise<WeeklyFocus> {
  const now = new Date();
  const periodStartDate = new Date(now);
  periodStartDate.setDate(periodStartDate.getDate() - 7);

  const news = await getArticles(7);
  const allArticles = Object.values(news).flat() as Article[];
  const candidates = buildWeeklyCandidates(allArticles, new Set(readLinks));

  const periodStart = periodStartDate.toISOString();
  const periodEnd = now.toISOString();

  if (!candidates.length) {
    return {
      title: "Veckofokus",
      summary: "Du har läst allt i veckans aktuella läskö.",
      stories: [],
      periodStart,
      periodEnd,
    };
  }

  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      "Du är Glenns veckoredaktör.",
      "",
      "Du skapar en personlig läslista med exakt 10 texter från de senaste 7 dagarna.",
      "",
      "SYFTE:",
      "Det här är INTE en nyhetssida. Glenn har redan fått morgonens nyheter och pushnotiser. Veckofokus ska hjälpa honom att i efterhand förstå veckan bättre och ge honom texter som är värda att sätta sig ner med.",
      "",
      "TÄNK SOM EN REDAKTIONELL VECKOÅTERBLICK:",
      "- Identifiera berättelser och teman som återkommit under veckan.",
      "- Välj texter som ger perspektiv, analys, personlighet eller fördjupning.",
      "- Om flera artiklar handlar om samma sak, välj normalt den som bäst förklarar eller sätter saken i perspektiv.",
      "- En viktig nyhet kan väljas, men vanliga korta nyhetsnotiser ska normalt inte prioriteras.",
      "- Krönika, analys, intervju, reportage, kommentar och recension väger normalt tyngre.",
      "- Använd newsScore som signal om betydelse och aktualitet.",
      "- Använd readingScore extra mycket för att hitta texter som faktiskt är värda Glenns tid.",
      "- Glenn uppskattar Elfsborg, men låt inte Elfsborg dominera hela listan om andra veckoberättelser är starkare.",
      "- Variera ämnen och källor när det förbättrar läsningen.",
      "- Läsarprofilen bygger på tidigare klick. Ett enstaka klick är bara en svag signal; återkommande mönster är viktigare.",
      "",
      "VIKTIGT:",
      "- Välj exakt 10 texter om det finns minst 10 kandidater.",
      "- Välj aldrig en artikel vars link finns i READ-LINKS.",
      "- Hitta inte på fakta.",
      "- Skriv naturlig och rak svenska.",
      "- Varje text ska ha en mycket kort sammanfattning och en tydlig anledning till varför den hör hemma i Veckofokus.",
      "",
      "LÄSARPROFIL:",
      JSON.stringify(profileForPrompt(profile), null, 2),
      "",
      "READ-LINKS:",
      JSON.stringify(readLinks, null, 2),
      "",
      "RETURNERA ENDAST GILTIG JSON:",
      JSON.stringify({
        summary: "4-6 meningar som beskriver vad veckan i stort handlade om och vilka återkommande berättelser som sticker ut.",
        stories: [{
          id: 0,
          articleType: "krönika|analys|intervju|reportage|kommentar|nyhet|notis|guide|recension|övrigt",
          summary: "1-2 meningar.",
          selectionReason: "1 kort mening om varför Glenn bör läsa.",
        }],
      }, null, 2),
      "",
      "ARTIKLAR FRÅN SENASTE 7 DAGARNA:",
      JSON.stringify(candidates, null, 2),
    ].join("\n"),
  });

  try {
    const parsed = JSON.parse(response.output_text) as {
      summary?: string;
      stories?: Array<{ id?: number; articleType?: string; summary?: string; selectionReason?: string }>;
    };

    const stories = (parsed.stories ?? [])
      .map(item => {
        const candidate = candidates.find(article => article.id === item.id);
        if (!candidate) return null;

        return {
          ...candidate,
          aiSummary: item.summary ?? "",
          selectionReason: item.selectionReason ?? "AI-redaktören bedömer att texten tillför perspektiv och fördjupning.",
          articleType: item.articleType || candidate.articleType,
        };
      })
      .filter((story): story is NonNullable<typeof story> => story !== null)
      .slice(0, 10)
      .map((story, index) => ({ ...story, id: index + 1 }));

    return {
      title: "Veckofokus",
      summary: parsed.summary?.trim() || "Veckans bästa fördjupningar och perspektiv samlade på ett ställe.",
      stories,
      periodStart,
      periodEnd,
    };
  } catch (error) {
    console.error("Weekly focus AI JSON failed:", error);

    return {
      title: "Veckofokus",
      summary: "Veckans bästa läsning, baserad på relevans, fördjupning och personliga signaler.",
      stories: candidates.slice(0, 10).map((article, index) => ({
        ...article,
        id: index + 1,
        aiSummary: article.description,
        selectionReason: "Vald utifrån nyhetsvärde, läsvärde och innehållstyp.",
        articleType: article.articleType,
      })),
      periodStart,
      periodEnd,
    };
  }
}