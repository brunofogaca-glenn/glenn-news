import OpenAI from "openai";
import { rankArticles } from "./ranker";
import {
  getOgImage,
} from "./articleImage";
import type {
  ReaderProfile,
} from "./readerProfile";

const OPENAI_TIMEOUT_MS = 45_000;

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 0,
    });
  }

  return openaiClient;
}

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
    semanticInterests: {
      topics: Object.fromEntries(Object.entries(profile.semanticTopic ?? {}).slice(0, 8)),
      tags: Object.fromEntries(Object.entries(profile.semanticTag ?? {}).slice(0, 8)),
      entities: Object.fromEntries(Object.entries(profile.entity ?? {}).slice(0, 8)),
    },
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

function normalizeStoryUrl(value?: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.*|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }

    return `${url.hostname.replace(/^www\./i, "")}${url.pathname}${url.search}`
      .replace(/\/$/, "")
      .toLowerCase();
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, "");
  }
}

function isValidArticleUrl(value?: string): value is string {
  if (!value || value.length > 2_048) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !/\s/.test(value)
    );
  } catch {
    return false;
  }
}

function normalizeStoryTitle(value?: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isDuplicateStory(
  article: Pick<Article, "link" | "title">,
  seenUrls: Set<string>,
  seenTitles: Set<string>
) {
  const urlKey = normalizeStoryUrl(article.link);
  const titleKey = normalizeStoryTitle(article.title);

  if (
    (urlKey && seenUrls.has(urlKey)) ||
    (titleKey && seenTitles.has(titleKey))
  ) {
    return true;
  }

  if (urlKey) seenUrls.add(urlKey);
  if (titleKey) seenTitles.add(titleKey);

  return false;
}

function completeWithFallbackStories(
  candidates: ReturnType<typeof buildCandidates>,
  selectCount: number,
  selectedStories: SelectedStory[] = []
): SelectedStory[] {
  const stories: SelectedStory[] = [];
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();

  // Defensively revalidate AI-selected stories before they can enter the edition.
  for (const story of selectedStories) {
    if (
      !isValidArticleUrl(story.link) ||
      !story.title?.trim() ||
      isDuplicateStory(story, seenUrls, seenTitles)
    ) {
      continue;
    }

    stories.push(story);
    if (stories.length >= selectCount) return stories;
  }

  // Fill any gaps with the next ranked candidates that have usable URLs.
  for (const candidate of candidates) {
    if (stories.length >= selectCount) break;
    if (
      !isValidArticleUrl(candidate.link) ||
      !candidate.title?.trim() ||
      isDuplicateStory(candidate, seenUrls, seenTitles)
    ) {
      continue;
    }

    stories.push({
      ...candidate,
      aiSummary: candidate.description?.trim() ?? "",
      selectionReason:
        "Automatiskt urval baserat på relevans, färskhet och innehållstyp.",
      articleType: candidate.articleType ?? "nyhet",
    });
  }

  if (stories.length < selectCount) {
    console.warn(
      "Editorial selection has fewer valid stories than requested:",
      { requested: selectCount, selected: stories.length }
    );
  }

  return stories;
}

function fallbackEditorialResult(
  articles: Article[],
  candidates: ReturnType<typeof buildCandidates>,
  selectCount: number
) {
  return {
    summary: fallbackSummary(articles),
    stories: completeWithFallbackStories(candidates, selectCount),
  };
}

type ImageArticle = {
  title: string;
  link?: string;
  image?: string | null;
};

const MAX_CONCURRENT_IMAGE_LOOKUPS = 8;
const IMAGE_LOOKUP_TIMEOUT_MS = 6_000;
const IMAGE_ENRICHMENT_BUDGET_MS = 25_000;

function imageArticleKey(article: ImageArticle, index: number) {
  const urlKey = normalizeStoryUrl(article.link);
  if (urlKey) return "url:" + urlKey;

  const titleKey = normalizeStoryTitle(article.title);
  return titleKey ? "title:" + titleKey : "anonymous:" + index;
}

/**
 * Enrich article images after editorial selection. Existing RSS image URLs are
 * kept first. Selected stories are processed before the eight leading Elfsborg
 * full-coverage articles. A shared worker pool and deadline prevent slow sites
 * from holding up the whole edition.
 */
export async function enrichEditorialImages(
  sections: EditorialSection[]
): Promise<EditorialSection[]> {
  const elfsborgSection = sections.find(section => section.key === "elfsborg");
  const elfsborgArticles = elfsborgSection?.allArticles ?? [];
  const selectedArticles = sections.flatMap(section => section.stories);

  const allReferences: ImageArticle[] = [];
  const seenObjects = new Set<ImageArticle>();
  for (const article of [...selectedArticles, ...elfsborgArticles]) {
    if (!seenObjects.has(article)) {
      seenObjects.add(article);
      allReferences.push(article);
    }
  }

  const aliases = new Map<string, ImageArticle[]>();
  const keysByObject = new Map<ImageArticle, string>();
  allReferences.forEach((article, index) => {
    const key = imageArticleKey(article, index);
    keysByObject.set(article, key);
    const group = aliases.get(key) ?? [];
    group.push(article);
    aliases.set(key, group);
  });

  const prioritizedReferences = [
    ...selectedArticles,
    ...elfsborgArticles.slice(0, 8),
  ];
  const priorityKeys: string[] = [];
  const seenKeys = new Set<string>();
  for (const article of prioritizedReferences) {
    const key = keysByObject.get(article);
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      priorityKeys.push(key);
    }
  }

  const jobs: Array<{ refs: ImageArticle[]; url: string }> = [];
  for (const key of priorityKeys) {
    const refs = aliases.get(key) ?? [];
    const existingImage = refs.find(article => article.image)?.image;
    if (existingImage) {
      refs.forEach(article => {
        if (!article.image) article.image = existingImage;
      });
      continue;
    }

    const url = refs.find(article => article.link)?.link;
    if (url) jobs.push({ refs, url });
  }

  if (!jobs.length) return sections;

  const deadline = Date.now() + IMAGE_ENRICHMENT_BUDGET_MS;
  let nextJob = 0;
  let completedJobs = 0;

  async function worker() {
    while (Date.now() < deadline) {
      const jobIndex = nextJob;
      nextJob += 1;
      if (jobIndex >= jobs.length) return;

      const job = jobs[jobIndex];
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) return;

      try {
        const image = await getOgImage(
          job.url,
          Math.min(IMAGE_LOOKUP_TIMEOUT_MS, remainingMs)
        );
        if (image) {
          job.refs.forEach(article => {
            if (!article.image) article.image = image;
          });
        }
      } catch (error) {
        console.warn("Editorial image lookup failed:", error);
      } finally {
        completedJobs += 1;
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_IMAGE_LOOKUPS, jobs.length);
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const deadlinePromise = new Promise<void>(resolve => {
    deadlineTimer = setTimeout(
      resolve,
      Math.max(0, deadline - Date.now())
    );
  });

  try {
    await Promise.race([
      Promise.all(Array.from({ length: workerCount }, () => worker())),
      deadlinePromise,
    ]);
  } finally {
    if (deadlineTimer) clearTimeout(deadlineTimer);
  }

  if (completedJobs < jobs.length) {
    console.warn(
      "Editorial image enrichment reached its time budget:",
      {
        completed: completedJobs,
        queuedOrPending: jobs.length - completedJobs,
        budgetMs: IMAGE_ENRICHMENT_BUDGET_MS,
      }
    );
  }

  return sections;
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

  try {
    const response =
      await getOpenAIClient().responses.create({
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

    const rawOutput = response.output_text?.trim();
    if (!rawOutput) {
      console.warn(
        "Editorial AI returned an empty response; using ranked fallback:",
        categoryKey
      );
      return fallbackEditorialResult(articles, candidates, selectCount);
    }

    const parsed = JSON.parse(rawOutput) as {
      summary?: unknown;
      stories?: Array<{
        id?: unknown;
        articleType?: unknown;
        summary?: unknown;
        selectionReason?: unknown;
      }>;
    };

    const selectedStories: SelectedStory[] = [];
    const seenIds = new Set<number>();
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const requestedStories = Array.isArray(parsed.stories)
      ? parsed.stories
      : [];

    for (const item of requestedStories) {
      const itemId = item?.id;
      if (
        typeof itemId !== "number" ||
        !Number.isInteger(itemId) ||
        seenIds.has(itemId)
      ) {
        continue;
      }

      const candidate = candidates.find(article => article.id === itemId);
      if (
        !candidate ||
        !isValidArticleUrl(candidate.link) ||
        !candidate.title?.trim() ||
        isDuplicateStory(candidate, seenUrls, seenTitles)
      ) {
        continue;
      }

      seenIds.add(itemId);
      selectedStories.push({
        ...candidate,
        aiSummary:
          typeof item.summary === "string" ? item.summary.trim() : "",
        selectionReason:
          typeof item.selectionReason === "string" &&
          item.selectionReason.trim()
            ? item.selectionReason.trim()
            : "AI-redaktören bedömer att texten är särskilt läsvärd.",
        articleType:
          typeof item.articleType === "string" &&
          ARTICLE_TYPES.includes(item.articleType)
            ? item.articleType
            : candidate.articleType ?? "nyhet",
      });

      if (selectedStories.length >= selectCount) break;
    }

    if (selectedStories.length === 0) {
      console.warn(
        "Editorial AI returned no valid stories; using ranked fallback:",
        categoryKey
      );
    } else if (selectedStories.length < Math.min(selectCount, candidates.length)) {
      console.warn(
        "Editorial AI returned too few valid stories; completing with ranked fallback:",
        categoryKey,
        selectedStories.length
      );
    }

    const stories = completeWithFallbackStories(
      candidates,
      selectCount,
      selectedStories
    );

    return {
      summary:
        typeof parsed.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim()
          : fallbackSummary(articles),
      stories,
    };
  } catch (error) {
    console.error(
      "Editorial AI failed; using ranked fallback for category:",
      categoryKey,
      error
    );

    return fallbackEditorialResult(articles, candidates, selectCount);
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

  const stories = [
    ...footballStories,
    ...otherStories,
  ];

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
      ranked.map((article, index) => ({
        id: index,
        ...article,
        aiSummary:
          article.title === mainStory?.title
            ? mainStory.aiSummary
            : "",
        selectionReason:
          article.title === mainStory?.title
            ? mainStory.selectionReason
            : "",
        articleType:
          inferArticleType(article),
      }));

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
    stories: ai.stories,
  };
}
