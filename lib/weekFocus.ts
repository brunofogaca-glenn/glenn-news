import OpenAI from "openai";
import { rankArticles } from "./ranker";
import { canonicalizeLink, collectWeeklyCandidates, type WeeklyCandidate } from "./weekFocusCandidates";
import { curateWeeklyCandidates, isNewswireCandidate } from "./weekFocusQuality";
import { inferArticleType } from "./articleType";
import { buildWeeklyInterestProfile } from "./weekFocusInterests";
import { createWeeklyFocusFingerprint, getOrCreateWeeklyFocus } from "./weekFocusCache";
import { getWeeklyReadLinks } from "./weeklyRead";
import {
  getSavedDailyEditions,
  getTodayDailyEdition,
  type DailyEdition,
} from "./dailyEdition";
import {
  getReaderActivitySince,
  type ReaderActivity,
  type ReaderProfile,
} from "./readerProfile";

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

type WeeklyStory = WeeklyCandidate & {
  id: number;
  focusTopic: string;
  topicReadCount: number;
};

export type WeeklyFocus = {
  title: string;
  summary: string;
  stories: WeeklyStory[];
  periodStart: string;
  periodEnd: string;
  editionCount: number;
  readArticleCount: number;
  topicCount: number;
  personalized: boolean;
};

type WeeklyFocusDependencies = {
  loadReaderActivity: typeof getReaderActivitySince;
  loadWeeklyReadLinks: typeof getWeeklyReadLinks;
  loadTodayEdition: typeof getTodayDailyEdition;
  loadSavedEditions: typeof getSavedDailyEditions;
  fingerprint: typeof createWeeklyFocusFingerprint;
  getOrCreate: typeof getOrCreateWeeklyFocus;
  generateEditorResponse: (input: string) => Promise<{ output_text: string }>;
};

function profileForPrompt(profile: ReaderProfile) {
  return {
    totalClicks: profile.totalClicks,
    category: profile.category,
    articleType: profile.articleType,
    source: profile.source,
    topic: profile.topic,
    semanticInterests: {
      categories: Object.fromEntries(Object.entries(profile.semanticCategory ?? {}).slice(0, 6)),
      articleTypes: Object.fromEntries(Object.entries(profile.semanticArticleType ?? {}).slice(0, 6)),
      topics: Object.fromEntries(Object.entries(profile.semanticTopic ?? {}).slice(0, 8)),
      tags: Object.fromEntries(Object.entries(profile.semanticTag ?? {}).slice(0, 8)),
      entities: Object.fromEntries(Object.entries(profile.entity ?? {}).slice(0, 8)),
    },
  };
}

function normalizeTopic(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

type ReadingSignal = {
  id: number;
  title: string;
  category: string;
  articleType: string;
  source: string;
  topic?: string;
  date: string;
};

function countUniqueReadArticles(activity: ReaderActivity[]) {
  const keys = new Set<string>();

  for (const item of activity) {
    const key = item.link
      ? canonicalizeLink(item.link)
      : normalizeTopic(item.title || item.topic || "") + "|" + item.category;
    if (key && key !== "|") keys.add(key);
  }

  return keys.size;
}

function buildReadingHistory(activity: ReaderActivity[]): ReadingSignal[] {
  const ordered = [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const seen = new Set<string>();
  const signals: ReadingSignal[] = [];

  for (const item of ordered) {
    const title = item.title?.trim() || item.topic?.trim() || "Läst artikel";
    const key = item.link ? canonicalizeLink(item.link) : normalizeTopic(title) + "|" + item.category;
    if (!key || seen.has(key)) continue;
    seen.add(key);

    signals.push({
      id: signals.length,
      title: title.slice(0, 260),
      category: item.category,
      articleType: item.articleType,
      source: item.source,
      topic: item.topic,
      date: item.timestamp.slice(0, 10),
    });
    if (signals.length >= 120) break;
  }

  return signals;
}

function buildCandidates(
  editions: DailyEdition[],
  readLinks: Set<string>,
  profile: ReaderProfile
) {
  const stories = collectWeeklyCandidates(editions, readLinks);
  const curatedStories = curateWeeklyCandidates(stories);
  const qualityByLink = new Map(
    curatedStories.map(story => [story.link, story.qualityScore] as const)
  );

  const metadataByLink = new Map(
    curatedStories.map(story => [
      story.link,
      {
        category: story.category,
        aiSummary: story.aiSummary,
        selectionReason: story.selectionReason,
      },
    ])
  );

  const ranked = rankArticles(
    curatedStories.map(story => ({ ...story, articleType: inferArticleType(story) })),
    profile
  );

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

  const byQuality = [...ranked].sort(
    (a, b) => (qualityByLink.get(b.link ?? "") ?? 0) - (qualityByLink.get(a.link ?? "") ?? 0)
  );

  const byNews = [...ranked].sort(
    (a, b) =>
      (b.newsScore ?? b.score ?? 0) -
      (a.newsScore ?? a.score ?? 0)
  );

  const selected: typeof ranked = [];
  const selectedLinks = new Set<string>();
  let selectedNewswireCount = 0;
  const MAX_NEWSWIRE_CANDIDATES = 12;

  function add(article: typeof ranked[number]) {
    const key = article.link || article.title;
    const isNewswire = isNewswireCandidate(article);

    if (
      !key ||
      selectedLinks.has(key) ||
      (isNewswire && selectedNewswireCount >= MAX_NEWSWIRE_CANDIDATES)
    ) {
      return;
    }

    selectedLinks.add(key);
    if (isNewswire) selectedNewswireCount += 1;
    selected.push(article);
  }

  // Put reading depth and original reporting ahead of raw news volume.
  // Wire material remains eligible but is capped when there are alternatives.
  byReading.slice(0, 25).forEach(add);
  byQuality.slice(0, 35).forEach(add);
  byNews.slice(0, 15).forEach(add);
  ranked
    .filter(article => preferredTypes.has(article.articleType ?? ""))
    .sort((a, b) => (qualityByLink.get(b.link ?? "") ?? 0) - (qualityByLink.get(a.link ?? "") ?? 0))
    .slice(0, 25)
    .forEach(add);

  return selected.slice(0, 60).map((article, index) => ({
    id: index,
    title: article.title,
    description: article.description ?? "",
    source: article.source ?? "Okänd källa",
    category: metadataByLink.get(article.link ?? "")?.category ?? "okänd",
    link: article.link ?? "",
    image: article.image ?? null,
    date: article.date ?? "",
    articleType: article.articleType ?? "nyhet",
    aiSummary: metadataByLink.get(article.link ?? "")?.aiSummary ?? "",
    selectionReason: metadataByLink.get(article.link ?? "")?.selectionReason ?? "",
    newsScore: article.newsScore,
    readingScore: article.readingScore,
    qualityScore: qualityByLink.get(article.link ?? "") ?? 0,
    isNewswire: isNewswireCandidate(article),
    topic: article.topic,
  }));
}

function fallbackStories(candidates: WeeklyCandidate[]): WeeklyStory[] {
  const stories: WeeklyStory[] = [];
  const seenTopics = new Set<string>();
  const seenLinks = new Set<string>();

  for (const candidate of candidates) {
    const focusTopic = candidate.topic?.trim() || candidate.title;
    const topicKey = normalizeTopic(focusTopic);
    const linkKey = canonicalizeLink(candidate.link);
    if (!topicKey || seenTopics.has(topicKey) || seenLinks.has(linkKey)) continue;

    seenTopics.add(topicKey);
    seenLinks.add(linkKey);
    stories.push({
      ...candidate,
      id: stories.length + 1,
      focusTopic,
      topicReadCount: 0,
      selectionReason: candidate.selectionReason || "En av veckans starkaste olästa texter i det tillgängliga urvalet.",
    });
    if (stories.length >= 10) break;
  }

  return stories;
}

function isValidWeeklyFocus(value: unknown): value is WeeklyFocus {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const focus = value as Partial<WeeklyFocus>;
  return (
    typeof focus.title === "string" &&
    typeof focus.summary === "string" &&
    Array.isArray(focus.stories) &&
    typeof focus.periodStart === "string" && Number.isFinite(Date.parse(focus.periodStart)) &&
    typeof focus.periodEnd === "string" && Number.isFinite(Date.parse(focus.periodEnd)) &&
    Number.isInteger(focus.editionCount) &&
    Number.isInteger(focus.readArticleCount) &&
    Number.isInteger(focus.topicCount) &&
    typeof focus.personalized === "boolean" &&
    focus.stories.every(story =>
      typeof story?.title === "string" &&
      typeof story.link === "string" &&
      typeof story.focusTopic === "string" &&
      typeof story.selectionReason === "string"
    )
  );
}
const defaultWeeklyFocusDependencies: WeeklyFocusDependencies = {
  loadReaderActivity: getReaderActivitySince,
  loadWeeklyReadLinks: getWeeklyReadLinks,
  loadTodayEdition: getTodayDailyEdition,
  loadSavedEditions: getSavedDailyEditions,
  fingerprint: createWeeklyFocusFingerprint,
  getOrCreate: getOrCreateWeeklyFocus,
  generateEditorResponse: input =>
    getOpenAIClient().responses.create({ model: "gpt-5-mini", input }),
};

export async function createWeeklyFocus(
  profile: ReaderProfile,
  dependencyOverrides: Partial<WeeklyFocusDependencies> = {}
): Promise<WeeklyFocus> {
  const dependencies = { ...defaultWeeklyFocusDependencies, ...dependencyOverrides };
  const weekStartDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [activity, savedWeeklyReadLinks] = await Promise.all([
    dependencies.loadReaderActivity(weekStartDate.toISOString(), 250),
    dependencies.loadWeeklyReadLinks(),
  ]);
  const readingHistory = buildReadingHistory(activity);
  const weeklyInterestProfile = buildWeeklyInterestProfile(readingHistory);
  const readLinks = new Set(
    [
      ...activity.map(item => item.link),
      ...savedWeeklyReadLinks,
    ]
      .filter((link): link is string => Boolean(link))
      .map(canonicalizeLink)
  );

  const todayEdition = await dependencies.loadTodayEdition(profile);
  const savedEditions = await dependencies.loadSavedEditions(7);
  const editions =
    savedEditions.some(edition => edition.dateKey === todayEdition.dateKey)
      ? savedEditions
      : [todayEdition, ...savedEditions].slice(0, 7);

  const candidates = buildCandidates(editions, readLinks, profile);
  const dates = editions.map(edition => edition.dateKey).sort();
  const periodStart = dates[0]
    ? new Date(dates[0] + "T05:00:00Z").toISOString()
    : new Date().toISOString();
  const periodEnd = dates.at(-1)
    ? new Date(dates.at(-1) + "T20:00:00Z").toISOString()
    : new Date().toISOString();

  const sharedFields = {
    periodStart,
    periodEnd,
    editionCount: editions.length,
    readArticleCount: countUniqueReadArticles(activity),
  };

  if (!editions.length) {
    return {
      title: "Veckofokus",
      summary: "Det finns ännu inga sparade morgoneditioner för veckan.",
      stories: [],
      ...sharedFields,
      topicCount: 0,
      personalized: false,
    };
  }

  if (!candidates.length) {
    return {
      title: "Veckofokus",
      summary: readingHistory.length
        ? "Det finns inga olästa fördjupningar kvar bland veckans sparade morgoneditioner. Nya kandidater kan tillkomma när nästa edition sparas."
        : "Det finns inga olästa artiklar i veckans sparade morgoneditioner just nu.",
      stories: [],
      ...sharedFields,
      topicCount: 0,
      personalized: readingHistory.length > 0,
    };
  }

  const candidatesForPrompt = candidates.map(candidate => ({
    id: candidate.id,
    title: candidate.title,
    description: candidate.description,
    source: candidate.source,
    category: candidate.category,
    articleType: candidate.articleType,
    date: candidate.date,
    topic: candidate.topic,
    link: candidate.link,
    aiSummary: candidate.aiSummary,
    selectionReason: candidate.selectionReason,
    newsScore: candidate.newsScore,
    readingScore: candidate.readingScore,
    qualityScore: candidate.qualityScore,
    isNewswire: candidate.isNewswire,
  }));

  const readingHistoryForPrompt = readingHistory.map(item => ({
    id: item.id,
    title: item.title,
    category: item.category,
    articleType: item.articleType,
    source: item.source,
    topic: item.topic ?? "",
    date: item.date,
  }));

  const promptProfile = profileForPrompt(profile);
  const cacheFingerprint = dependencies.fingerprint({
    cacheSchema: "weekfocus-v24",
    sharedFields,
    periodStart,
    periodEnd,
    profile: promptProfile,
    weeklyInterestProfile,
    readingHistory: readingHistoryForPrompt,
    candidates: candidatesForPrompt,
  });

  return dependencies.getOrCreate<WeeklyFocus>(
    cacheFingerprint,
    async () => {
      try {
    const response = await dependencies.generateEditorResponse([
        "Du är Glenns personliga veckoredaktör på Glenn News.",
        "",
        "UPPDRAG:",
        "Identifiera upp till tio ämnen som Glenn tydligast visat intresse för genom att öppna artiklar under de senaste sju dagarna. Välj exakt en ny, oläst artikel att läsa vidare om för varje ämne.",
        "Detta är inte en vanlig topp tio över veckans nyheter. Varje val ska koppla ihop vad Glenn faktiskt läste med den bästa olästa fördjupningen från veckans sparade morgoneditioner.",
        "",
        "LÄSHISTORIK:",
        "- READ-HISTORY innehåller faktiska klick från Glenn News under de senaste sju dygnen. ID motsvarar unika lästa artiklar och är bevis på intresse.",
        "- Gruppera liknande rubriker till meningsfulla ämnen. Räkna hur många unika READ-HISTORY-ID:n som stödjer respektive ämne.",
        "- Sortera de tydligaste och vanligaste läsämnena först. Återkommande läsning väger mer än ett enstaka klick.",
        "- readIds måste innehålla verkliga ID:n ur READ-HISTORY; hitta inte på ID:n och använd helst inte samma lästa artikel i flera ämnen.",
        "- Om READ-HISTORY är tom ska du inte påstå att ämnen bygger på läsningen. Välj då i stället de bästa olästa fördjupningarna utifrån profil och redaktionell kvalitet.",
        "",
        "VAL AV ARTIKEL:",
        "- Välj bara artiklar ur CANDIDATES. id måste motsvara en kandidat; hitta inte på rubriker, artiklar eller länkar.",
        "- CANDIDATES har redan filtrerats så att artiklar som Glenn öppnat under de senaste sju dygnen inte finns med.",
        "- Välj en text som tar ämnet vidare: analys, krönika, intervju, reportage, bakgrund eller granskning väger tyngre än en kort notis.",
        "- qualityScore signalerar fördjupning och redaktionellt läsvärde; prioritera höga värden när ämnet passar läshistoriken.",
        "- isNewswire markerar byråmaterial. Använd det när det tillför viktig information, men välj hellre en originell analys, intervju, krönika eller ett reportage om alternativen täcker ämnet lika bra.",
        "- Nästan identiska rubriker har rensats bort, men kontrollera fortfarande att valen ger olika vinklar och inte bara återberättar samma händelse.",
        "- En ny artikel om samma ämne som Glenn redan läst är bra om den ger en ny vinkel eller fördjupning.",
        "- En artikel och en tydlig ämnesetikett per plats. Dubbletter av artiklar eller ämnen ska undvikas.",
        "- Välj upp till tio ämnen; tvinga inte fram tio om olästa kandidater eller lässignaler inte räcker.",
        "- Låt den faktiska läshistoriken väga tyngst, med långsiktig profil som stöd. Hitta inte på fakta.",
        "",
        "LÅNGSIKTIG LÄSARPROFIL:",
        JSON.stringify(promptProfile),
        "",
        "VECKANS FAKTISKA LÄSINTRESSE (räknat från unika artiklar i READ-HISTORY):",
        JSON.stringify(weeklyInterestProfile),
        "- weeklyInterestProfile är en deterministisk sammanräkning av verkliga klick, inte en gissning från den långsiktiga profilen.",
        "- articleCount betyder antal olika lästa artiklar där signalen förekommer; räkna inte samma signal flera gånger inom en artikel.",
        "- Använd återkommande ämnen och ord för att prioritera grupperingen, men länka varje valt ämne till giltiga readIds i READ-HISTORY.",
        "",
        "READ-HISTORY:",
        JSON.stringify(readingHistoryForPrompt),
        "",
        "CANDIDATES (olästa texter):",
        JSON.stringify(candidatesForPrompt),
        "",
        "Returnera ENDAST giltig JSON med formen:",
        JSON.stringify({
          summary: "4–6 meningar om de ämnen Glenn återkommit till under veckan och vad som binder dem samman. Var tydlig om läshistorik saknas.",
          stories: [{
            id: 0,
            topic: "Kort, distinkt etikett på ämnet",
            readIds: [0, 1],
            summary: "2–4 meningar om vad artikeln tillför och vilken bakgrund den ger.",
            selectionReason: "En konkret mening om varför just denna olästa artikel är nästa bästa läsning.",
            articleType: "analys"
          }]
        }, null, 2),
      ].join("\n"));

    const parsed = JSON.parse(response.output_text) as {
      summary?: string;
      stories?: Array<{
        id?: number;
        topic?: string;
        readIds?: number[];
        summary?: string;
        selectionReason?: string;
        articleType?: string;
      }>;
    };

    const historyIds = new Set(readingHistory.map(item => item.id));
    const claimedReadIds = new Set<number>();
    const usedTopics = new Set<string>();
    const usedLinks = new Set<string>();
    const selected: WeeklyStory[] = [];

    for (const item of parsed.stories ?? []) {
      const candidate = candidates.find(article => article.id === item.id);
      if (!candidate) continue;

      const linkKey = canonicalizeLink(candidate.link);
      if (!linkKey || usedLinks.has(linkKey)) continue;

      const focusTopic = item.topic?.trim().slice(0, 100) ||
        candidate.topic?.trim() || candidate.title;
      const topicKey = normalizeTopic(focusTopic);
      if (!topicKey || usedTopics.has(topicKey)) continue;

      const supportedReadIds = [...new Set(item.readIds ?? [])]
        .filter(id => historyIds.has(id) && !claimedReadIds.has(id));

      if (readingHistory.length > 0 && supportedReadIds.length === 0) continue;

      for (const id of supportedReadIds) claimedReadIds.add(id);
      usedTopics.add(topicKey);
      usedLinks.add(linkKey);

      selected.push({
        ...candidate,
        focusTopic,
        topicReadCount: supportedReadIds.length,
        aiSummary: item.summary?.trim() || candidate.aiSummary,
        selectionReason: item.selectionReason?.trim() || candidate.selectionReason,
        articleType: item.articleType || candidate.articleType,
      });
    }

    selected.sort((a, b) => b.topicReadCount - a.topicReadCount);

    if (readingHistory.length === 0 && selected.length < 10) {
      const fallback = fallbackStories(candidates);
      const seenLinks = new Set(selected.map(story => canonicalizeLink(story.link)));
      const seenTopics = new Set(selected.map(story => normalizeTopic(story.focusTopic)));

      for (const story of fallback) {
        const linkKey = canonicalizeLink(story.link);
        const topicKey = normalizeTopic(story.focusTopic);
        if (seenLinks.has(linkKey) || seenTopics.has(topicKey)) continue;
        selected.push({ ...story, id: 0 });
        seenLinks.add(linkKey);
        seenTopics.add(topicKey);
        if (selected.length >= 10) break;
      }
    }

    const stories = selected.slice(0, 10).map((story, index) => ({
      ...story,
      id: index + 1,
    }));
    const personalized = readingHistory.length > 0 &&
      stories.some(story => story.topicReadCount > 0);

    return {
      title: "Veckofokus",
      summary: parsed.summary?.trim() ||
        (personalized
          ? "Veckans olästa fördjupningar utifrån ämnena du själv återkommit till."
          : "Veckans bästa olästa fördjupningar, rangordnade efter nyhetsvärde och långsiktiga intressen."),
      stories,
      ...sharedFields,
      topicCount: stories.length,
      personalized,
    };
  } catch (error) {
    console.error("Weekly focus generation failed:", error);
    const stories = fallbackStories(candidates);
    return {
      title: "Veckofokus",
      summary: readingHistory.length > 0
        ? "Veckans läshistorik kunde inte analyseras just nu. Här är en reservlista med olästa fördjupningar; den påstår inte att de motsvarar dina toppämnen."
        : "Ingen veckoläshistorik fanns tillgänglig. Här är de bästa olästa fördjupningarna utifrån nyhetsvärde och långsiktig profil.",
      stories,
      ...sharedFields,
      topicCount: stories.length,
      personalized: false,
    };
      }
    },
    isValidWeeklyFocus
  );
}
