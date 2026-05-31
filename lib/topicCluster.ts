type Article = {
  title: string;
  description?: string;
  source?: string;
  date?: string;
  link?: string;
  image?: string | null;
};

const STOP_WORDS = [
  "och",
  "att",
  "den",
  "det",
  "som",
  "för",
  "med",
  "till",
  "från",
  "har",
  "om",
  "på",
  "av",
  "i",
  "the",
  "a",
  "an",
  "is",
  "are",
  "of",
  "to",
  "in",
  "for",
];

function extractKeywords(
  text: string
) {
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

function similarity(
  a: string[],
  b: string[]
) {
  const setA = new Set(a);
  const setB = new Set(b);

  let overlap = 0;

  for (const word of setA) {
    if (setB.has(word)) {
      overlap++;
    }
  }

  return overlap;
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
    const keywords =
      extractKeywords(article.title);

    let matchedCluster = null;

    for (const cluster of clusters) {
      const score = similarity(
        keywords,
        cluster.keywords
      );

      if (score >= 2) {
        matchedCluster = cluster;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.articles.push(
        article
      );
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
    articles: cluster.articles,
  }));
}