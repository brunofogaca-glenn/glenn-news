import { clusterTopics } from "./topicCluster";
import { inferArticleType } from "./articleType";
import type { ReaderProfile } from "./readerProfile";

type Article = {
  title: string;
  description?: string;
  source?: string;
  date?: string;
  link?: string;
  image?: string | null;
  articleType?: string;
  topic?: string;
};

const TIER_1 = [
  "elfsborg",
  "borås arena",
  "if elfsborg",
  "graham potter",
  "landslaget",
  "fotbollslandslaget",
  "gyökeres",
  "alexander isak",
  "besfort zeneli",
  "elitloppet",
  "björn hamberg",
  "borås",
  "sjuhärad",
  "socialism",
  "allsvenskan",
  "vänsterpartiet",
  "socialdemokraterna",
  "svenska cupen",
  "öresjö",
  "sjöbo",
  "cervenka",
  "manchester united",
  "michael carrick",
  "barcelona",
  "hansi flick",
  "roma",
  "as roma",
  "serie a",
  "gasperini",
  "italy",
  "italien",
  "ica banken",
];

const TIER_2 = [
  "fotboll",
  "premier league",
  "champions league",
  "conference league",
  "svensk elitfotboll",
  "europa league",
  "bolån",
  "tennis",
  "skidskytte",
  "skidor",
  "andreasson",
  "film",
  "indiepop",
];

const TIER_3 = [
  "sverige",
  "regeringen",
  "riksdagen",
  "riksbanken",
  "börsen",
  "omxs30",
  "nasdaq",
  "bitcoin",
  "inflation",
  "ränta",
  "arbetslöshet",
  "atp",
  "grand slam",
  "wta",
  "roland garros",
  "wimbledon",
];

const TIER_4 = [
  "ukraina",
  "ryssland",
  "putin",
  "trump",
  "usa",
  "kina",
  "nato",
  "eu",
  "israel",
  "hormuz",
  "gaza",
  "iran",
  "krig",
  "terror",
  "jordbävning",
  "president",
  "val",
  "världshändelse",
  "världsnyheter",
  "breaking news",
  "global",
  "internationellt",
  "konflikt",
  "kris",
  "sanktioner",
  "vapenvila",
  "invasion",
  "militär",
  "försvar",
  "missil",
  "attack",
  "diplomati",
  "säkerhet",
  "inflation",
  "recession",
  "börs",
  "oljepris",
  "gaspris",
  "handel",
  "ekonomi",
  "ai",
  "artificiell intelligens",
  "cybersäkerhet",
  "hackare",
  "teknik",
  "klimat",
  "storm",
  "orkan",
  "översvämning",
  "vulkan",
  "tsunami",
  "naturkatastrof",
  "pandemi",
  "epidemi",
  "virus",
  "who",
  "war",
  "conflict",
  "crisis",
  "attack",
  "missile",
  "election",
  "president",
  "government",
  "military",
  "economy",
  "inflation",
  "recession",
  "earthquake",
  "hurricane",
  "flood",
  "wildfire",
  "climate",
  "artificial intelligence",
  "cybersecurity",
  "united nations",
  "nato",
  "china",
  "russia",
  "ukraine",
  "israel",
  "iran",
  "gaza",
  "taiwan",
  "fn",
  "un",
  "europa",
  "asien",
  "afrika",
];

const BREAKING_TERMS = [
  "klart",
  "klar",
  "officiellt",
  "värvar",
  "övergång",
  "avslöjar",
  "granskning",
  "avgår",
  "sparkas",
  "kris",
  "skandal",
  "död",
  "attack",
  "rekord",
  "historisk",
  "final",
  "mästare",
  "vinner",
];

function scoreTerms(
  text: string,
  terms: string[],
  value: number
) {
  let score = 0;

  for (const term of terms) {
    if (text.includes(term)) {
      score += value;
    }
  }

  return score;
}

function calculatePersonalScore(
  article: Article
) {
  const text =
    `${article.title} ${article.description ?? ""}`.toLowerCase();

  let score = 0;

  score += scoreTerms(text, TIER_1, 50);
  score += scoreTerms(text, TIER_2, 30);
  score += scoreTerms(text, TIER_3, 20);
  score += scoreTerms(text, TIER_4, 10);

  // Long-term/fixed preferences are useful, but must not swamp broad news.
  return Math.min(42, score);
}


const PUBLIC_IMPORTANCE_SIGNALS = [
  {
    weight: 8,
    cap: 24,
    terms: [
      "regeringskris", "regeringen avgår", "statsminister avgår", "misstroende",
      "valresultat", "ny regering", "president avgår", "presidentval",
      "parlamentsval", "riksdagen", "lagstiftning", "grundlag", "government resigns",
      "prime minister resigns", "election result", "parliament votes", "impeachment",
    ],
  },
  {
    weight: 8,
    cap: 26,
    terms: [
      "invasion", "vapenvila", "bombning", "bombningar", "luftangrepp", "offensiv",
      "krig", "terrorattack", "gisslan", "kärnvapen", "missilangrepp", "sanktioner",
      "ceasefire", "airstrike", "air strikes", "hostage", "nuclear threat",
      "military offensive", "war escalates", "peace deal", "attacks civilian",
    ],
  },
  {
    weight: 9,
    cap: 27,
    terms: [
      "jordbävning", "tsunami", "orkan", "översvämning", "skogsbrand", "naturkatastrof",
      "evakueras", "masskrock", "rasar samman", "dödsoffer", "flera döda",
      "katastrofläge", "emergency declared", "mass casualty", "major earthquake",
      "wildfire", "flooding forces", "evacuation order", "disaster zone",
    ],
  },
  {
    weight: 6,
    cap: 20,
    terms: [
      "finanskris", "börsras", "bankkollaps", "styrräntan", "riksbanken höjer",
      "riksbanken sänker", "recession", "lågkonjunktur", "massuppsägning",
      "massvarsel", "statsbudget", "statsbankrutt", "market crash", "bank collapse",
      "central bank emergency", "sovereign debt crisis",
    ],
  },
  {
    weight: 6,
    cap: 18,
    terms: [
      "pandemi", "epidemi", "smittutbrott", "folkhälsokris", "klimatnödläge",
      "värmerekord", "kärnkraftsolycka", "radioaktivt läckage", "antibiotikaresistens",
      "public health emergency", "disease outbreak", "nuclear accident",
      "record-breaking heat", "climate emergency",
    ],
  },
] as const;

/**
 * Broad public-interest signals are independent of Glenn's click history.
 * Multi-source coverage and freshness are scored elsewhere; this provides a
 * separate boost for high-impact events that deserve attention even if novel
 * to the reader.
 */
function calculatePublicImportanceScore(article: Article) {
  const text = `${article.title} ${article.description ?? ""}`
    .toLocaleLowerCase("sv-SE");

  let score = 0;
  for (const group of PUBLIC_IMPORTANCE_SIGNALS) {
    score += Math.min(group.cap, scoreTerms(text, [...group.terms], group.weight));
  }

  return Math.min(60, score);
}

function calculateReadingScore(
  article: Article
) {
  // Use the same article-type classifier that feeds editorial selection, so
  // a stale generic "nyhet" label doesn't hide a real analysis or column.
  const articleType = inferArticleType(article);

  let score = 30;

  if (articleType === "krönika") {
    score = 100;
  } else if (articleType === "analys") {
    score = 90;
  } else if (articleType === "intervju") {
    score = 85;
  } else if (articleType === "reportage") {
    score = 80;
  } else if (articleType === "kommentar") {
    score = 75;
  } else if (articleType === "recension") {
    score = 70;
  } else if (articleType === "guide") {
    score = 55;
  } else if (articleType === "notis") {
    score = 15;
  }

  const descriptionLength =
    (article.description ?? "").length;

  // A longer description is a weak depth signal, never a replacement for type.
  return Math.min(
    120,
    score + Math.min(20, Math.round(descriptionLength / 120))
  );
}

function calculateProfileAffinity(
  article: Article,
  profile: ReaderProfile
) {
  const text =
    `${article.title} ${article.description ?? ""}`.toLowerCase();

  if (profile.totalClicks <= 0) {
    return 0;
  }

  let score = 0;

  for (const [category, value] of Object.entries(profile.category)) {
    if (text.includes(category.toLowerCase())) {
      score += Math.min(18, value * 0.45);
    }
  }

  for (const [source, value] of Object.entries(profile.source)) {
    if (
      (article.source ?? "")
        .toLowerCase()
        .includes(source.toLowerCase())
    ) {
      score += Math.min(10, value * 0.35);
    }
  }

  const type = (article.articleType ?? "").toLowerCase();
  const typeAffinity = profile.articleType[type] ?? 0;
  score += Math.min(14, typeAffinity * 0.35);

  for (const [topic, value] of Object.entries(profile.topic)) {
    const normalizedTopic = topic.toLowerCase().trim();

    if (
      normalizedTopic.length >= 5 &&
      text.includes(normalizedTopic)
    ) {
      score += Math.min(14, value * 0.3);
    }
  }

  const confidence = Math.min(1, profile.totalClicks / 20);
  // Repeat behavior is useful evidence, but the entire historical profile has
  // a fixed ceiling so it cannot overwhelm breaking or widely covered news.
  return Math.min(14, score * (0.3 + confidence * 0.7));
}


function scoreSemanticMapMatches(
  text: string,
  values: Record<string, number> | undefined,
  minimumLength: number,
  factor: number,
  perItemCap: number,
  totalCap: number
) {
  let score = 0;

  for (const [rawKey, value] of Object.entries(values ?? {})) {
    const key = rawKey.toLocaleLowerCase("sv-SE").trim();
    if (key.length < minimumLength || !text.includes(key)) continue;
    score += Math.min(perItemCap, value * factor);
    if (score >= totalCap) return totalCap;
  }

  return Math.min(totalCap, score);
}

/**
 * Semantic affinity generalizes clicks across publishers and section labels.
 * Only the article's metadata is classified by AI; the click history remains
 * private and is aggregated locally into recency-weighted interest maps.
 */
function calculateSemanticAffinity(
  article: Article,
  profile: ReaderProfile
) {
  if ((profile.semanticClicks ?? 0) <= 0) return 0;

  const text = `${article.title} ${article.description ?? ""} ${article.topic ?? ""}`
    .toLocaleLowerCase("sv-SE");

  const type = (article.articleType ?? "").toLocaleLowerCase("sv-SE");
  const typeAffinity = Math.min(6, (profile.semanticArticleType?.[type] ?? 0) * 0.8);
  const score =
    scoreSemanticMapMatches(text, profile.semanticTopic ?? {}, 4, 1.5, 5, 14) +
    scoreSemanticMapMatches(text, profile.semanticTag ?? {}, 4, 0.8, 3, 10) +
    scoreSemanticMapMatches(text, profile.entity ?? {}, 4, 1.5, 6, 16) +
    scoreSemanticMapMatches(text, profile.geography ?? {}, 4, 0.45, 2, 5) +
    scoreSemanticMapMatches(text, profile.eventKey ?? {}, 6, 0.35, 1.5, 3) +
    typeAffinity;

  const learningConfidence = Math.min(1, (profile.semanticClicks ?? 0) / 8);
  // Semantic matching is an additional hint, not a hard filter or a dominant score.
  return Math.min(18, score) * (0.25 + learningConfidence * 0.75);
}

function calculateRecencyScore(
  article: Article
) {
  if (!article.date) return 0;

  const ageHours =
    (Date.now() -
      new Date(article.date).getTime()) /
    (1000 * 60 * 60);

  return Math.round(
    50 * Math.exp(-ageHours / 24)
  );
}

export function rankArticles(
  articles: Article[],
  profile: ReaderProfile = {
    category: {},
    articleType: {},
    source: {},
    topic: {},
    semanticCategory: {},
    semanticArticleType: {},
    semanticTopic: {},
    semanticTag: {},
    entity: {},
    geography: {},
    eventKey: {},
    semanticClicks: 0,
    totalClicks: 0,
    lastUpdated: null,
  }
) {
  const clusters =
    clusterTopics(articles);

  const ranked = articles.map(
    article => {
      const cluster =
        clusters.find(c =>
          c.articles.some(
            a =>
              a.title ===
              article.title
          )
        );

      const mentions =
        cluster?.mentions ?? 1;

      const uniqueSources =
        cluster?.uniqueSources ?? 1;

      const editorialEchoScore =
        Math.log2(
          mentions + 1
        ) *
        uniqueSources *
        25;

      const sourceDiversityScore =
        uniqueSources * 15;

      const clusterScore =
        editorialEchoScore +
        sourceDiversityScore;

      const fixedPreferenceScore = calculatePersonalScore(article);
      const behaviorProfileScore = calculateProfileAffinity(article, profile);
      const semanticProfileScore = calculateSemanticAffinity(article, profile);
      const personalizationScore = Math.min(
        55,
        fixedPreferenceScore + behaviorProfileScore + semanticProfileScore
      );

      const publicImportanceScore = calculatePublicImportanceScore(article);
      const recencyScore = calculateRecencyScore(article);

      const newsScore =
        clusterScore +
        publicImportanceScore +
        personalizationScore +
        recencyScore;

      const readingScore =
        calculateReadingScore(article);

      const score =
        newsScore +
        readingScore * 0.4;

      return {
        ...article,
        score,
        newsScore,
        readingScore,
        publicImportanceScore,
        personalizationScore,
        mentions,
        uniqueSources,
        topic:
          cluster?.topic ??
          article.title,
      };
    }
  );

  return ranked.sort(
    (a, b) => b.score - a.score
  );
}
