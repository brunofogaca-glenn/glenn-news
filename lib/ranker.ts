import { clusterTopics } from "./topicCluster";
import type { ReaderProfile } from "./readerProfile";

type Article = {
  title: string;
  description?: string;
  source?: string;
  date?: string;
  link?: string;
  image?: string | null;
  articleType?: string;
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
  score += scoreTerms(text, BREAKING_TERMS, 15);

  return score;
}

function calculateReadingScore(
  article: Article
) {
  const text =
    (article.title + " " + (article.description ?? "")).toLowerCase();

  const articleType =
    (article.articleType ?? "").toLowerCase();

  const scoringText =
    articleType + " " + text;

  let score = 30;

  if (/krönika|krönikör|kolumn/.test(scoringText)) {
    score = 100;
  } else if (/analys|expert|därför|bedömer/.test(scoringText)) {
    score = 90;
  } else if (/intervju|intervjuar/.test(scoringText)) {
    score = 85;
  } else if (/reportage|på plats|möter|berättar/.test(scoringText)) {
    score = 80;
  } else if (/kommentar|ledare|opinion/.test(scoringText)) {
    score = 75;
  } else if (/recension|recenserar|betyg/.test(scoringText)) {
    score = 70;
  } else if (/guide|tips|så fungerar/.test(scoringText)) {
    score = 55;
  } else if (/notis|i korthet/.test(scoringText)) {
    score = 15;
  }

  const descriptionLength =
    (article.description ?? "").length;

  return Math.min(
    120,
    score +
      Math.min(20, Math.round(descriptionLength / 120))
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
  return score * (0.3 + confidence * 0.7);
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

      const personalScore =
        calculatePersonalScore(article) +
        calculateProfileAffinity(article, profile);

      const recencyScore =
        calculateRecencyScore(
          article
        );

      const newsScore =
        clusterScore +
        personalScore +
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
