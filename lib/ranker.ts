import { clusterTopics } from "./topicCluster";

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
    `\${article.title} \${article.description ?? ""}`.toLowerCase();

  let score = 30;

  if (/krönika|krönikör|kolumn/.test(text)) {
    score = 100;
  } else if (/analys|expert|därför|bedömer/.test(text)) {
    score = 90;
  } else if (/intervju|intervjuar/.test(text)) {
    score = 85;
  } else if (/reportage|på plats|möter|berättar/.test(text)) {
    score = 80;
  } else if (/kommentar|ledare|opinion/.test(text)) {
    score = 75;
  } else if (/recension|recenserar|betyg/.test(text)) {
    score = 70;
  } else if (/guide|tips|så fungerar/.test(text)) {
    score = 55;
  } else if (/notis|i korthet/.test(text)) {
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
  articles: Article[]
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
        calculatePersonalScore(
          article
        );

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
