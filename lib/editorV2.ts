import OpenAI from "openai";
import { rankArticles } from "./ranker";
import {
  getOgImage,
} from "./articleImage";
import type {
  ReaderProfile,
} from "./readerProfile";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Article = {
  title: string;
  description?: string;
  source?: string;
  date?: string;
  link?: string;
  image?: string | null;
  articleType?: string;
  score?: number;
  newsScore?: number;
  readingScore?: number;
  mentions?: number;
  uniqueSources?: number;
  topic?: string;
};

type SelectedStory = Article & {
  id: number;
  aiSummary: string;
  selectionReason: string;
  articleType: string;
  sportGroup?: "fotboll" | "övrig sport";
};

export type EditorialSection = {
  key: string;
  title: string;
  summary: string;
  stories: SelectedStory[];
  allArticles?: SelectedStory[];
};

const ARTICLE_TYPES = [
  "krönika",
  "analys",
  "intervju",
  "reportage",
  "kommentar",
  "nyhet",
  "notis",
  "guide",
  "recension",
  "övrigt",
];

function inferArticleType(
  article: Article
): string {
  if (article.articleType) {
    return article.articleType;
  }

  const text = (
    `${article.title} ${article.description ?? ""}`
  ).toLowerCase();

  if (
    /krönika|krönikor|krönikör/.test(text)
  ) {
    return "krönika";
  }

  if (
    /analys|expert|bedömer|så kan|därför/.test(
      text
    )
  ) {
    return "analys";
  }

  if (
    /intervju|intervjuar|säger till/.test(
      text
    )
  ) {
    return "intervju";
  }

  if (
    /reportage|berättar|på plats|möter/.test(
      text
    )
  ) {
    return "reportage";
  }

  if (
    /kommentar|ledare|opinion/.test(text)
  ) {
    return "kommentar";
  }

  if (
    /guide|så gör du|tips|så fungerar/.test(
      text
    )
  ) {
    return "guide";
  }

  if (
    /recension|betyg|recenserar/.test(text)
  ) {
    return "recension";
  }

  if (
    /notis|i korthet/.test(text)
  ) {
    return "notis";
  }

  return "nyhet";
}

function profileForPrompt(
  profile: ReaderProfile
) {
  return {
    totalClicks: profile.totalClicks,
    category: profile.category,
    articleType: profile.articleType,
    source: profile.source,
    topic: profile.topic,
  };
}

function buildCandidates(
  articles: Article[],
  profile: ReaderProfile,
  excludeTrav = false
) {
  const filteredArticles =
    excludeTrav
      ? articles.filter(article => {
      const text =
        (article.title + " " + (article.description ?? "")).toLowerCase();

      const isTrav =
        [
          "trav",
          "v75",
          "v86",
          "atg",
          "kusk",
          "travhäst",
          "travlopp",
          "sulkylopp",
          "riks toto",
        ].some(term => text.includes(term));

      return isTrav ? false : true;
        })
      : articles;

  const typedInput = filteredArticles.map(article => ({
    ...article,
    articleType: inferArticleType(article),
  }));

  const ranked = rankArticles(typedInput, profile);

  const rankedByNews =
    [...ranked].sort(
      (a, b) =>
        (b.newsScore ?? b.score ?? 0) -
        (a.newsScore ?? a.score ?? 0)
    );

  const rankedByReading =
    [...ranked].sort(
      (a, b) =>
        (b.readingScore ?? 0) -
        (a.readingScore ?? 0)
    );

  const typed = ranked.map(article => ({
    ...article,
    articleType:
      inferArticleType(article),
  }));

  const typedByNews =
    rankedByNews.map(article => ({
      ...article,
      articleType:
        inferArticleType(article),
    }));

  const typedByReading =
    rankedByReading.map(article => ({
      ...article,
      articleType:
        inferArticleType(article),
    }));

  const preferredTypes = new Set([
    "krönika",
    "analys",
    "intervju",
    "reportage",
    "kommentar",
  ]);

  const selected: typeof typed = [];
  const seen = new Set<string>();

  function add(article: typeof typed[number]) {
    const key =
      article.link ||
      article.title;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    selected.push(article);
  }

  typedByNews
    .slice(0, 20)
    .forEach(add);

  typedByReading
    .slice(0, 20)
    .forEach(add);

  typedByReading
    .filter(article =>
      preferredTypes.has(
        article.articleType
      )
    )
    .slice(0, 15)
    .forEach(add);

  typed
    .slice(0, 10)
    .forEach(add);

  return selected
    .slice(0, 40)
    .map((article, index) => ({
      id: index,
      title: article.title,
      description:
        article.description ?? "",
      source:
        article.source ?? "Okänd källa",
      link: article.link ?? "",
      image: article.image ?? null,
      date: article.date ?? "",
      score: article.score ?? 0,
      newsScore:
        article.newsScore ?? article.score ?? 0,
      readingScore:
        article.readingScore ?? 0,
      mentions: article.mentions ?? 1,
      uniqueSources:
        article.uniqueSources ?? 1,
      topic:
        article.topic ?? article.title,
      articleType:
        article.articleType,
    }));
}

function fallbackSummary(
  articles: Article[]
) {
  const pieces = articles
    .slice(0, 3)
    .map(article => article.description?.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (!pieces.length) {
    return "Det finns inga tillräckliga uppgifter för en lägesbild just nu.";
  }

  return pieces.join(" ");
}

async function ensureImages(
  stories: SelectedStory[]
) {
  await Promise.all(
    stories.map(async story => {
      if (
        !story.image &&
        story.link
      ) {
        story.image =
          await getOgImage(
            story.link
          );
      }
    })
  );

  return stories;
}

async function runEditorialAI(
  categoryKey: string,
  categoryTitle: string,
  articles: Article[],
  profile: ReaderProfile,
  selectCount: number
) {
  const candidates =
    buildCandidates(
      articles,
      profile,
      categoryKey === "sport"
    );

  if (!candidates.length) {
    return {
      summary: "",
      stories: [],
    };
  }

  const response =
    await openai.responses.create({
      model: "gpt-5-mini",
      input: `
Du är Glenns personliga morgonredaktör.

Du ska redigera en morgontidning för EN person, Glenn.

Glenn får redan pushnotiser under dagen. Därför ska Glenn News INTE försöka ge honom flest möjliga nyheter. Din uppgift är att:
1. ge en kort, träffsäker lägesbild,
2. välja exakt ${selectCount} texter som är mest värda att läsa.

KATEGORI:
${categoryTitle}

ARTIKELTYPER:
Krönika, analys, intervju, reportage, kommentar och annan fördjupning ska normalt väga tyngre för läsning än vanliga nyhetsnotiser.

POÄNGSIGNALER:
- newsScore uppskattar nyhetsvärde: aktualitet, betydelse, personlig relevans och hur brett en händelse bevakas.
- readingScore uppskattar läsvärde: fördjupning, perspektiv och sannolikheten att texten är värd Glenns lästid.
- Använd readingScore extra tydligt när du väljer "Dagens läsning", men låt högt nyhetsvärde vinna när en nyhet är exceptionellt viktig.

GLENNS GRUNDPREFERENSER:
- Elfsborg ska ha full täckning; materialet ska inte filtreras bort på grund av mängd.
- I alla andra områden ska Glenn hellre få få riktigt bra texter än många vanliga nyhetsartiklar.
- Krönikor är särskilt uppskattade.
- Analys, intervju, reportage och kommentar är också starkt prioriterade.
- Vanliga nyhetsnotiser är främst till för lägesbilden, inte som läsning.
- Tidigare klick ska påverka urvalet mer när det finns ett tydligt återkommande mönster.
- Trav och hästkapplöpning ska normalt inte väljas till Övrig sport. Prioritera tennis och andra sporter framför trav.

VIKTIGT:
- Maskinell score är bara ett signalvärde. Gör själv den redaktionella bedömningen.
- Undvik upprepningar om flera artiklar beskriver samma händelse.
- Välj inte två texter som i praktiken säger samma sak.
- Prioritera innehåll som ger perspektiv, analys, personlighet eller fördjupning.
- Välj en vanlig nyhet framför en krönika om nyheten faktiskt är ovanligt viktig för Glenn.
- Läsarprofilen är baserad på tidigare klick och är en signal, inte en absolut sanning.
- Glenn föredrar normalt få riktigt bra läsningar framför många mediokra.
- Skriv naturlig och rak svenska.
- Hitta inte på fakta som inte finns i underlaget.

LÄSARPROFIL:
${JSON.stringify(
  profileForPrompt(profile),
  null,
  2
)}

RETURNERA ENDAST GILTIG JSON:
{
  "summary": "4-5 meningar om dagens läge i området.",
  "stories": [
    {
      "id": 0,
      "articleType": "krönika|analys|intervju|reportage|kommentar|nyhet|notis|guide|recension|övrigt",
      "summary": "Mycket kort sammanfattning.",
      "selectionReason": "En kort mening om varför Glenn bör läsa texten."
    }
  ]
}

ARTIKLAR:
${JSON.stringify(
  candidates,
  null,
  2
)}
`,
    });

  try {
    const parsed =
      JSON.parse(
        response.output_text
      ) as {
        summary?: string;
        stories?: Array<{
          id?: number;
          articleType?: string;
          summary?: string;
          selectionReason?: string;
        }>;
      };

    const stories =
      (parsed.stories ?? [])
        .map(item => {
          const candidate =
            candidates.find(
              article =>
                article.id ===
                item.id
            );

          if (!candidate) {
            return null;
          }

          return {
            ...candidate,
            aiSummary:
              item.summary ?? "",
            selectionReason:
              item.selectionReason ??
              "AI-redaktören bedömer att texten är särskilt läsvärd.",
            articleType:
              item.articleType &&
              ARTICLE_TYPES.includes(
                item.articleType
              )
                ? item.articleType
                : candidate.articleType,
          };
        })
        .filter(
          (
            story
          ): story is NonNullable<typeof story> =>
            story !== null
        )
        .slice(0, selectCount);

    return {
      summary:
        parsed.summary?.trim() ||
        fallbackSummary(articles),
      stories,
    };
  } catch (error) {
    console.error(
      "Editorial AI JSON failed:",
      error
    );

    return {
      summary:
        fallbackSummary(articles),
      stories:
        candidates
          .slice(0, selectCount)
          .map(article => ({
            ...article,
            aiSummary:
              article.description ?? "",
            selectionReason:
              "Automatiskt urval baserat på relevans, färskhet och innehållstyp.",
            articleType:
              article.articleType,
          })),
    };
  }
}

function combineSportSummaries(
  footballSummary: string,
  otherSummary: string
) {
  function firstSentences(value: string) {
    const sentences =
      value.match(/[^.!?]+[.!?]+/g) ?? [];

    return sentences
      .slice(0, 2)
      .join(" ")
      .trim();
  }

  return [
    firstSentences(footballSummary),
    firstSentences(otherSummary),
  ]
    .filter(Boolean)
    .join(" ");
}

export async function createSportEditorialSection(
  footballArticles: Article[],
  otherSportArticles: Article[],
  profile: ReaderProfile
): Promise<EditorialSection> {
  const [footballAI, otherAI] =
    await Promise.all([
      runEditorialAI(
        "fotboll",
        "Fotboll",
        footballArticles,
        profile,
        4
      ),
      runEditorialAI(
        "sport",
        "Övrig sport",
        otherSportArticles,
        profile,
        2
      ),
    ]);

  const footballStories =
    footballAI.stories.map(
      (story, index) => ({
        ...story,
        id: index,
        sportGroup:
          "fotboll" as const,
      })
    );

  const otherStories =
    otherAI.stories.map(
      (story, index) => ({
        ...story,
        id: 1000 + index,
        sportGroup:
          "övrig sport" as const,
      })
    );

  const stories =
    await ensureImages([
      ...footballStories,
      ...otherStories,
    ]);

  return {
    key: "sport",
    title: "Sport",
    summary: combineSportSummaries(
      footballAI.summary,
      otherAI.summary
    ),
    stories,
  };
}

export async function createEditorialSection(
  categoryKey: string,
  categoryTitle: string,
  articles: Article[],
  profile: ReaderProfile
): Promise<EditorialSection> {
  const ranked = rankArticles(
    articles.map(article => ({
      ...article,
      articleType: inferArticleType(article),
    })),
    profile
  );

  if (!ranked.length) {
    return {
      key: categoryKey,
      title: categoryTitle,
      summary:
        "Inga aktuella artiklar hittades.",
      stories: [],
    };
  }

  if (categoryKey === "elfsborg") {
    const ai =
      await runEditorialAI(
        categoryKey,
        categoryTitle,
        ranked.slice(0, 25),
        profile,
        1
      );

    const mainStory =
      ai.stories[0];

    const allArticles =
      await ensureImages(
        ranked.map((article, index) => ({
          id: index,
          ...article,
        aiSummary:
          article.title ===
          mainStory?.title
            ? mainStory.aiSummary
            : "",
        selectionReason:
          article.title ===
          mainStory?.title
            ? mainStory.selectionReason
            : "",
          articleType:
            inferArticleType(article),
        }))
      );

    return {
      key: categoryKey,
      title: categoryTitle,
      summary: ai.summary,
      stories: mainStory
        ? [mainStory]
        : [],
      allArticles,
    };
  }

  const ai =
    await runEditorialAI(
      categoryKey,
      categoryTitle,
      ranked,
      profile,
      4
    );

  return {
    key: categoryKey,
    title: categoryTitle,
    summary: ai.summary,
    stories:
      await ensureImages(
        ai.stories
      ),
  };
}
