import OpenAI from "openai";
import { rankArticles } from "./ranker";
import {
  getSavedDailyEditions,
  getTodayDailyEdition,
  type DailyEdition,
} from "./dailyEdition";
import type { ReaderProfile } from "./readerProfile";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type WeeklyCandidate = {
  id: number;
  title: string;
  description: string;
  source: string;
  category: string;
  link: string;
  image: string | null;
  date: string;
  articleType: string;
  aiSummary: string;
  selectionReason: string;
  newsScore?: number;
  readingScore?: number;
  topic?: string;
};

type WeeklyStory = WeeklyCandidate & {
  id: number;
};

export type WeeklyFocus = {
  title: string;
  summary: string;
  stories: WeeklyStory[];
  periodStart: string;
  periodEnd: string;
  editionCount: number;
};

function profileForPrompt(profile: ReaderProfile) {
  return {
    totalClicks: profile.totalClicks,
    category: profile.category,
    articleType: profile.articleType,
    source: profile.source,
    topic: profile.topic,
  };
}

function buildCandidates(
  editions: DailyEdition[],
  readLinks: Set<string>
) {
  const seen = new Set<string>();
  const stories: WeeklyCandidate[] = [];

  // Newest edition first. If the same article appeared on multiple mornings,
  // keep the first occurrence so the weekly pool stays clean.
  for (const edition of editions) {
    for (const section of edition.sections) {
      for (const story of section.stories) {
        const link = story.link ?? "";

        if (!link || readLinks.has(link) || seen.has(link)) {
          continue;
        }

        seen.add(link);

        stories.push({
          id: stories.length,
          title: story.title,
          description: story.description ?? "",
          source: story.source ?? "Okänd källa",
          category: section.key,
          link,
          image: story.image ?? null,
          date: story.date ?? edition.generatedAt,
          articleType: story.articleType,
          aiSummary: story.aiSummary ?? "",
          selectionReason: story.selectionReason ?? "",
          newsScore: story.newsScore,
          readingScore: story.readingScore,
          topic: story.topic,
        });
      }
    }
  }

  const categoryByLink = new Map(
    stories.map(story => [story.link, story.category])
  );

  const ranked = rankArticles(stories);

  const preferredTypes = new Set([
    "krönika",
    "analys",
    "intervju",
    "reportage",
    "kommentar",
    "recension",
  ]);

  const byReading = [...ranked].sort(
    (a, b) => (b.readingScore ?? 0) - (a.readingScore ?? 0)
  );

  const byNews = [...ranked].sort(
    (a, b) =>
      (b.newsScore ?? b.score ?? 0) -
      (a.newsScore ?? a.score ?? 0)
  );

  const selected: typeof ranked = [];
  const selectedLinks = new Set<string>();

  function add(article: typeof ranked[number]) {
    const key = article.link || article.title;

    if (!key || selectedLinks.has(key)) {
      return;
    }

    selectedLinks.add(key);
    selected.push(article);
  }

  byReading.slice(0, 35).forEach(add);
  byNews.slice(0, 35).forEach(add);
  ranked
    .filter(article => preferredTypes.has(article.articleType ?? ""))
    .slice(0, 30)
    .forEach(add);

  return selected.slice(0, 60).map((article, index) => ({
    id: index,
    title: article.title,
    description: article.description ?? "",
    source: article.source ?? "Okänd källa",
    category: categoryByLink.get(article.link ?? "") ?? "okänd",
    link: article.link ?? "",
    image: article.image ?? null,
    date: article.date ?? "",
    articleType: article.articleType ?? "nyhet",
    aiSummary: article.aiSummary ?? "",
    selectionReason: article.selectionReason ?? "",
    newsScore: article.newsScore,
    readingScore: article.readingScore,
    topic: article.topic,
  }));
}

export async function createWeeklyFocus(
  profile: ReaderProfile,
  readLinks: string[]
): Promise<WeeklyFocus> {
  const todayEdition = await getTodayDailyEdition(profile);
  const savedEditions = await getSavedDailyEditions(7);
  const editions =
    savedEditions.some(edition => edition.dateKey === todayEdition.dateKey)
      ? savedEditions
      : [todayEdition, ...savedEditions].slice(0, 7);

  const readSet = new Set(readLinks);
  const candidates = buildCandidates(editions, readSet);

  const dates = editions
    .map(edition => edition.dateKey)
    .sort();

  const periodStart =
    dates[0]
      ? new Date(dates[0] + "T05:00:00Z").toISOString()
      : new Date().toISOString();

  const periodEnd =
    dates.at(-1)
      ? new Date(dates.at(-1) + "T20:00:00Z").toISOString()
      : new Date().toISOString();

  if (!editions.length) {
    return {
      title: "Veckofokus",
      summary:
        "Det finns ännu inga sparade morgoneditioner för veckan.",
      stories: [],
      periodStart,
      periodEnd,
      editionCount: 0,
    };
  }

  if (!candidates.length) {
    return {
      title: "Veckofokus",
      summary:
        "Du har läst allt som hittills valts ut i veckans morgoneditioner.",
      stories: [],
      periodStart,
      periodEnd,
      editionCount: editions.length,
    };
  }

  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      "Du är Glenns veckoredaktör.",
      "",
      "Du ska skapa Veckofokus utifrån de senaste sparade morgoneditionerna från Glenn News.",
      "Detta är INTE en ny sammanställning av RSS-flöden. Kandidaterna nedan är texter som Glenn News faktiskt valde ut under morgonens redaktionella arbete.",
      "",
      "SYFTE:",
      "Veckofokus ska hjälpa Glenn att förstå veckan i efterhand och ge honom texter som är värda att sätta sig ner med.",
      "",
      "REDaktionella principer:",
      "- Identifiera återkommande berättelser, teman och utvecklingar i veckans editioner.",
      "- Välj normalt den bästa texten när flera editioner länkar till samma berättelse.",
      "- Prioritera krönika, analys, intervju, reportage, kommentar och recension.",
      "- En viktig nyhet får ta plats om den är central för veckan.",
      "- Variera ämnen och källor när det förbättrar listan.",
      "- Elfsborg är viktigt för Glenn, men ska inte dominera listan utan att förtjäna platserna.",
      "- Läsarprofilen bygger på tidigare klick. Ett enstaka klick är en svag signal; återkommande mönster väger tyngre.",
      "- Välj aldrig en artikel som finns i READ-LINKS.",
      "- Hitta inte på fakta.",
      "",
      "VIKTIGT:",
      "- Välj exakt 10 texter om minst 10 kandidater finns.",
      "- Kandidaterna innehåller redan Glenn News egna sammanfattningar och urvalsorsaker. Använd dem som kontext.",
      "",
      "LÄSARPROFIL:",
      JSON.stringify(profileForPrompt(profile), null, 2),
      "",
      "READ-LINKS:",
      JSON.stringify(readLinks, null, 2),
      "",
      "SPARADE MORGONEDITIONER:",
      JSON.stringify(
        editions.map(edition => ({
          dateKey: edition.dateKey,
          generatedAt: edition.generatedAt,
          sections: edition.sections.map(section => ({
            key: section.key,
            title: section.title,
            storyCount: section.stories.length,
          })),
        })),
        null,
        2
      ),
      "",
      "RETURNERA ENDAST GILTIG JSON:",
      JSON.stringify(
        {
          summary:
            "4-6 meningar om vad veckan handlade om och vilka berättelser eller teman som återkom.",
          stories: [
            {
              id: 0,
              articleType:
                "krönika|analys|intervju|reportage|kommentar|nyhet|notis|guide|recension|övrigt",
              summary: "1-2 meningar.",
              selectionReason: "1 kort mening om varför Glenn bör läsa.",
            },
          ],
        },
        null,
        2
      ),
      "",
      "KANDIDATER FRÅN SPARADE EDITIONER:",
      JSON.stringify(candidates, null, 2),
    ].join("\n"),
  });

  try {
    const parsed = JSON.parse(response.output_text) as {
      summary?: string;
      stories?: Array<{
        id?: number;
        articleType?: string;
        summary?: string;
        selectionReason?: string;
      }>;
    };

    const stories = (parsed.stories ?? [])
      .map(item => {
        const candidate = candidates.find(
          article => article.id === item.id
        );

        if (!candidate) {
          return null;
        }

        return {
          ...candidate,
          aiSummary: item.summary ?? candidate.aiSummary,
          selectionReason:
            item.selectionReason ?? candidate.selectionReason,
          articleType: item.articleType || candidate.articleType,
        };
      })
      .filter(
        (story): story is NonNullable<typeof story> =>
          story !== null
      )
      .slice(0, 10)
      .map((story, index) => ({
        ...story,
        id: index + 1,
      }));

    return {
      title: "Veckofokus",
      summary:
        parsed.summary?.trim() ||
        "Veckans bästa fördjupningar och perspektiv samlade från Glenn News morgoneditioner.",
      stories,
      periodStart,
      periodEnd,
      editionCount: editions.length,
    };
  } catch (error) {
    console.error("Weekly focus AI JSON failed:", error);

    return {
      title: "Veckofokus",
      summary:
        "Veckans bästa läsning, baserad på Glenn News sparade morgoneditioner.",
      stories: candidates.slice(0, 10).map((article, index) => ({
        ...article,
        id: index + 1,
      })),
      periodStart,
      periodEnd,
      editionCount: editions.length,
    };
  }
}
