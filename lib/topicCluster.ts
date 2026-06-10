type Article = {
  title: string;
  description?: string;
  source?: string;
  date?: string;
  link?: string;
  image?: string | null;
};

const STOP_WORDS = [
  "och","att","den","det","som","för","med","till","från",
  "har","om","på","av","i",
  "the","a","an","is","are","of","to","in","for",

  "fotboll",
  "allsvenskan",
  "match",
  "spelare",
  "laget",
  "klubben",
  "tränaren",
  "säsongen",
  "vinst",
  "förlust",
  "seger"
];

function extractKeywords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\wåäö\s]/g, " ")
    .split(/\s+/)
    .filter(
      word =>
        word.length > 3 &&
        !STOP_WORDS.includes(word)
    );
}

function jaccardSimilarity(
  a: string[],
  b: string[]
) {
  const setA = new Set(a);
  const setB = new Set(b);

  const intersection =
    [...setA].filter(word =>
      setB.has(word)
    ).length;

  const union =
    new Set([...setA, ...setB]).size;

  return union === 0
    ? 0
    : intersection / union;
}

export function clusterTopics(
  articles: Article[]
) {
  const clusters: {
    topic: string;
    articles: Article[];
    keywords: string[];
  }[] = [];

  for (const article of articles) {
    const keywords = extractKeywords(
      `${article.title} ${article.description ?? ""}`
    );

    let bestCluster = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const score =
        jaccardSimilarity(
          keywords,
          cluster.keywords
        );

      if (
        score > bestScore &&
        score > 0.25
      ) {
        bestCluster = cluster;
        bestScore = score;
      }
    }

    if (bestCluster) {
      bestCluster.articles.push(
        article
      );

      bestCluster.keywords = [
        ...new Set([
          ...bestCluster.keywords,
          ...keywords,
        ]),
      ];
    } else {
      clusters.push({
        topic: article.title,
        articles: [article],
        keywords,
      });
    }
  }

  return clusters.map(cluster => ({
    topic: cluster.topic,
    mentions:
      cluster.articles.length,
    uniqueSources:
      new Set(
        cluster.articles.map(
          a => a.source
        )
      ).size,
    articles: cluster.articles,
  }));
}
