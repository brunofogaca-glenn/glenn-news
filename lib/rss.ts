import Parser from "rss-parser";
import { detectCategory } from "./categorizer";
import { getWebArticles } from "./webSources";
import { normalizeArticleUrl } from "./articleUrl";
import { canRefreshEditorialSourcesNow } from "./updateSchedule";

/**
 * Build a comparison key for article links so tracking tags and cosmetic URL
 * differences do not produce duplicate stories. Keep non-tracking query
 * parameters because some publishers use them to identify the actual article.
 */
const TITLE_STOPWORDS = new Set([
  "och", "att", "det", "den", "de", "en", "ett", "i", "på", "av", "för",
  "med", "mot", "om", "som", "till", "från", "efter", "innan", "nu",
  "har", "hade", "blir", "blev", "är", "var", "the", "a", "an", "and",
  "to", "of", "in", "on", "for", "with", "after", "as", "at", "by",
  "is", "are", "was", "were", "has", "have", "had", "will", "from",
]);

function normalizeArticleTitle(value?: string) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function getHeadlineTokens(value: string) {
  return new Set(
    normalizeArticleTitle(value)
      .split(/\s+/)
      .filter(token => token.length > 2 && !TITLE_STOPWORDS.has(token))
  );
}

/**
 * Conservative title matching catches near-identical headlines without
 * merging stories that merely mention the same team, person, or event.
 * Short headlines are matched only when their normalized wording is exact.
 */
function isDuplicateHeadline(
  title: string,
  seenTitles: Map<string, Set<string>>,
  titleKeysByToken: Map<string, Set<string>>
) {
  const normalizedTitle = normalizeArticleTitle(title);
  if (!normalizedTitle) return false;
  if (seenTitles.has(normalizedTitle)) return true;

  const tokens = getHeadlineTokens(normalizedTitle);
  if (tokens.size < 4) return false;

  const candidateKeys = new Set<string>();
  for (const token of tokens) {
    for (const key of titleKeysByToken.get(token) ?? []) {
      candidateKeys.add(key);
    }
  }

  for (const key of candidateKeys) {
    const previousTokens = seenTitles.get(key);
    if (!previousTokens) continue;

    let shared = 0;
    for (const token of tokens) {
      if (previousTokens.has(token)) shared += 1;
    }

    const smaller = Math.min(tokens.size, previousTokens.size);
    const union = tokens.size + previousTokens.size - shared;
    const containment = smaller ? shared / smaller : 0;
    const jaccard = union ? shared / union : 0;

    if (shared >= 4 && containment >= 0.8 && jaccard >= 0.65) {
      return true;
    }
  }

  return false;
}

function rememberHeadline(
  title: string,
  seenTitles: Map<string, Set<string>>,
  titleKeysByToken: Map<string, Set<string>>
) {
  const normalizedTitle = normalizeArticleTitle(title);
  if (!normalizedTitle || seenTitles.has(normalizedTitle)) return;

  const tokens = getHeadlineTokens(normalizedTitle);
  seenTitles.set(normalizedTitle, tokens);

  for (const token of tokens) {
    const keys = titleKeysByToken.get(token) ?? new Set<string>();
    keys.add(normalizedTitle);
    titleKeysByToken.set(token, keys);
  }
}

function extractImageFromContent(
  html: string
) {
  const patterns = [
    /<(?:img|source)[^>]+(?:src|data-src|data-lazy-src|srcset)=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractImage(item: any) {
  try {
    if (item.enclosure?.url) {
      return item.enclosure.url;
    }

    const mediaContent = item["media:content"];
    const mediaContentUrl =
      Array.isArray(mediaContent)
        ? mediaContent[0]?.$?.url
        : mediaContent?.$?.url ?? mediaContent?.url;

    if (mediaContentUrl) {
      return mediaContentUrl;
    }

    const mediaThumbnail = item["media:thumbnail"];
    const mediaThumbnailUrl =
      Array.isArray(mediaThumbnail)
        ? mediaThumbnail[0]?.$?.url
        : mediaThumbnail?.$?.url ?? mediaThumbnail?.url;

    if (mediaThumbnailUrl) {
      return mediaThumbnailUrl;
    }

    if (typeof item["content:encoded"] === "string") {
      const image = extractImageFromContent(
        item["content:encoded"]
      );

      if (image) return image;
    }

    if (typeof item.content === "string") {
      const image = extractImageFromContent(item.content);

      if (image) return image;
    }

    return null;
  } catch {
    return null;
  }
}

const parser = new Parser({
  customFields: {
    item: [
      "media:content",
      "media:thumbnail",
      "content:encoded",
    ],
  },
});

export type FeedConfig = {
  url: string;
  category: string;
  articleType?: string;
};

export const FEEDS: FeedConfig[] = [
  { url: "https://www.dn.se/nyheter/sverige/m/rss/senaste-nytt", category: "sverige" },
  { url: "https://www.bt.se/feeds/section/elfsborg/feed.xml", category: "elfsborg" },
  { url: "http://expressen.se/rss/fotboll", category: "fotboll" },
  { url: "http://www.aftonbladet.se/sportbladet/fotboll/rss.xml", category: "fotboll" },
  { url: "http://www.football-italia.net/rss.xml", category: "fotboll" },
  { url: "https://feeds.expressen.se/dinapengar/", category: "ekonomi" },
  { url: "https://www.bt.se/feeds/section/boras/feed.xml", category: "boras" },
  { url: "https://www.bt.se/feeds/section/kronikor/feed.xml", category: "livsstil", articleType: "krönika" },
  { url: "http://www.svt.se/nyheter/ekonomi/rss.xml", category: "ekonomi" },
  { url: "https://www.bt.se/feeds/section/sverige/feed.xml", category: "sverige" },
  { url: "https://www.bt.se/feeds/section/naringsliv/feed.xml", category: "ekonomi" },
  { url: "https://www.dn.se/ekonomi/m/rss/senaste-nytt", category: "ekonomi" },
  { url: "https://www.avanza.se/placera/forstasidan.rss.xml", category: "ekonomi" },
  { url: "https://www.bt.se/feeds/section/varlden/feed.xml", category: "varlden" },
  { url: "https://www.dn.se/nyheter/varlden/m/rss/senaste-nytt", category: "varlden" },
  { url: "https://www.bt.se/feeds/section/kultur-noje/feed.xml", category: "livsstil" },
  { url: "https://www.dn.se/film-rss", category: "livsstil" },
  { url: "https://www.bt.se/feeds/section/bollebygd/feed.xml", category: "boras" },
  { url: "https://feeds.expressen.se/nyheter/sverige/", category: "sverige" },
  { url: "https://feeds.expressen.se/sport/tennis/", category: "tennis" },
  { url: "https://feeds.expressen.se/nyheter/varlden/", category: "varlden" },
  { url: "https://elfsborg.se/feed/", category: "elfsborg" },
  { url: "https://www.privataaffarer.se/rss.xml", category: "ekonomi" },
  { url: "http://guliganerna.se/feed/", category: "elfsborg" },
  { url: "https://feeds.expressen.se/sport/vintersport/", category: "sport" },
  { url: "https://feeds.expressen.se/sport/os/", category: "sport" },
  { url: "https://www.offside.org/feed/", category: "fotboll", articleType: "reportage" },
  { url: "https://www.dn.se/musik-rss", category: "livsstil" },
  { url: "https://feeds.expressen.se/sport/tennis/", category: "tennis" },
  { url: "https://www.moviezine.se/feed", category: "livsstil" },
  { url: "https://www.transfermarkt.com/rss/news", category: "fotboll" },
  { url: "http://www.svt.se/sport/fotboll/rss.xml", category: "fotboll" },
  { url: "http://feeds.guardian.co.uk/theguardian/football/manchester-united/rss", category: "fotboll" },
  { url: "http://www1.skysports.com/feeds/11667/news.xml", category: "fotboll" },  
  { url: "http://feeds.feedburner.com/sportsblogs/BavarianFootballWorks", category: "fotboll" },
  { url: "http://www.guardian.co.uk/football/bundesligafootball/rss", category: "fotboll" },
  { url: "https://www.marca.com/en/rss/googlenews/football/barcelona.xml", category: "fotboll" },
  { url: "http://www.guardian.co.uk/football/laligafootball/rss", category: "fotboll" },
  { url: "http://feeds.guardian.co.uk/theguardian/football/premierleague/rss", category: "fotboll" },
  { url: "https://romapress.net/feed/", category: "fotboll" },
  { url: "http://www.guardian.co.uk/football/serieafootball/rss", category: "fotboll" },
  { url: "http://news.bbc.co.uk/rss/sportonline_world_edition/tennis/rss091.xml", category: "tennis" },
  { url: "http://www.guardian.co.uk/sport/tennis/rss", category: "tennis" },
  { url: "https://feeds.expressen.se/noje/", category: "livsstil" },
  { url: "https://www.dn.se/sport/m/rss/senaste-nytt", category: "sport" },
];

function isTravArticle(article: {
  title: string;
  description?: string;
}) {
  const text =
    (article.title + " " + (article.description ?? "")).toLowerCase();

  return [
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
}

export type Article = {
  title: string;
  description: string;
  link: string;
  date: string;
  source: string;
  image: string | null;
  articleType?: string;
};
export async function parseFeed(url: string) {
  if (!canRefreshEditorialSourcesNow()) {
    throw new Error("RSS-hämtning är spärrad före 06.00 Europe/Stockholm.");
  }

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Glenn News/1.0)",
      Accept:
        "application/rss+xml, application/xml, text/xml",
    },
  
  });

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}`
    );
  }

  const xml = await response.text();

  return parser.parseString(xml);
}
export async function getArticles(daysBack = 1) {
  if (!canRefreshEditorialSourcesNow()) {
    throw new Error("Artikelhämtning är spärrad före 06.00 Europe/Stockholm.");
  }

  const result = {
    elfsborg: [] as Article[],
    boras: [] as Article[],
    sverige: [] as Article[],
    varlden: [] as Article[],
    ekonomi: [] as Article[],
    fotboll: [] as Article[],
    tennis: [] as Article[],
    sport: [] as Article[],
    livsstil: [] as Article[],
  };

  const cutoff =
    Date.now() -
    daysBack * 24 * 60 * 60 * 1000;

const [feeds, webArticles] =
  await Promise.all([
    Promise.allSettled(
      FEEDS.map(feed =>
        parseFeed(feed.url)
      )
    ),
    getWebArticles(),
  ]);

  // Keep exact URL duplicates from RSS feeds out of the editorial pool.
  // URL variants and title-level duplicates are handled in later cleanup steps.
  const seen = new Set<string>();
  const seenTitles = new Map<string, Set<string>>();
  const titleKeysByToken = new Map<string, Set<string>>();

  feeds.forEach(
    (feedResult, index) => {
      const feed = FEEDS[index];

      if (
        feedResult.status !==
        "fulfilled"
      ) {
      console.error(
  `RSS misslyckades: ${feed.url}`,
  feedResult.reason
);
        return;
      }

      const articles: Article[] =
        feedResult.value.items
          .map(item => ({
            title: item.title ?? "",
            description:
              item.contentSnippet ?? "",
            link: item.link ?? "",
            date: item.pubDate ?? "",
            source:
              feedResult.value.title ??
              "",
            image: extractImage(item),
            articleType: feed.articleType,
          }))
          .filter(article => {
            const date = new Date(
              article.date
            ).getTime();

            return (
              !isNaN(date) &&
              date > cutoff
            );
          })
          .sort((a, b) => {
            return (
              new Date(
                b.date
              ).getTime() -
              new Date(
                a.date
              ).getTime()
            );
          })


      articles.forEach(article => {
        const detectedCategory =
          detectCategory(article);

        const finalCategory =
          detectedCategory ??
          feed.category;

        if (
          finalCategory === "sport" &&
          isTravArticle(article)
        ) {
          return;
        }

        const articleUrlKey = normalizeArticleUrl(article.link);
        if (
          (articleUrlKey && seen.has(articleUrlKey)) ||
          isDuplicateHeadline(article.title, seenTitles, titleKeysByToken)
        ) {
          return;
        }

        if (articleUrlKey) {
          seen.add(articleUrlKey);
        }
        rememberHeadline(article.title, seenTitles, titleKeysByToken);

        result[
          finalCategory as keyof typeof result
        ].push(article);
      });
    }
  );

  (Object.keys(webArticles) as Array<keyof typeof webArticles>).forEach(
    category => {
      webArticles[category].forEach(article => {
        const date = new Date(article.date).getTime();

        if (
          !article.title ||
          !article.link ||
          isNaN(date) ||
          date <= cutoff
        ) {
          return;
        }

        if (
          category === "sport" &&
          isTravArticle(article)
        ) {
          return;
        }

        const articleUrlKey = normalizeArticleUrl(article.link);
        if (
          (articleUrlKey && seen.has(articleUrlKey)) ||
          isDuplicateHeadline(article.title, seenTitles, titleKeysByToken)
        ) {
          return;
        }

        if (articleUrlKey) seen.add(articleUrlKey);
        rememberHeadline(article.title, seenTitles, titleKeysByToken);
        result[category].push(article);
      });
    }
  );

  Object.values(result).forEach(articles => {
    articles.sort(
      (a, b) =>
        new Date(b.date).getTime() -
        new Date(a.date).getTime()
    );
  });

  return result;
}
