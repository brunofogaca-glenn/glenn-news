import Parser from "rss-parser";
import { detectCategory } from "./categorizer";

function extractImageFromContent(
  html: string
) {
  const match = html.match(
    /<img[^>]+src="([^"]+)"/i
  );

  return match?.[1] ?? null;
}

function extractImage(item: any) {
  try {
    if (item.enclosure?.url) {
      return item.enclosure.url;
    }

    const mediaContent =
      item["media:content"];

    if (Array.isArray(mediaContent)) {
      const url =
        mediaContent[0]?.$?.url;

      if (url) return url;
    }

    const mediaThumbnail =
      item["media:thumbnail"];

    if (Array.isArray(mediaThumbnail)) {
      const url =
        mediaThumbnail[0]?.$?.url;

      if (url) return url;
    }

    if (
      typeof item["content:encoded"] ===
      "string"
    ) {
      const image =
        extractImageFromContent(
          item["content:encoded"]
        );

      if (image) return image;
    }

    if (typeof item.content === "string") {
      const image =
        extractImageFromContent(
          item.content
        );

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

const FEEDS = [
  { url: "https://www.dn.se/nyheter/sverige/m/rss/senaste-nytt", category: "sverige" },
  { url: "https://www.bt.se/feeds/section/elfsborg/feed.xml", category: "elfsborg" },
  { url: "http://expressen.se/rss/fotboll", category: "fotboll" },
  { url: "http://www.aftonbladet.se/sportbladet/fotboll/rss.xml", category: "fotboll" },
  { url: "http://www.football-italia.net/rss.xml", category: "fotboll" },
  { url: "https://feeds.expressen.se/dinapengar/", category: "ekonomi" },
  { url: "https://www.bt.se/feeds/section/boras/feed.xml", category: "boras" },
  { url: "https://www.bt.se/feeds/section/kronikor/feed.xml", category: "livsstil" },
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
  { url: "https://www.offside.org/feed/", category: "fotboll" },
  { url: "https://www.dn.se/musik-rss", category: "livsstil" },
  { url: "https://feeds.expressen.se/sport/trav/", category: "sport" }, 
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

type Article = {
  title: string;
  description: string;
  link: string;
  date: string;
  source: string;
  image: string | null;
};
async function parseFeed(url: string) {
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
export async function getArticles() {
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

  const yesterday =
    Date.now() -
    24 * 60 * 60 * 1000;

const feeds =
  await Promise.allSettled(
    FEEDS.map(feed =>
      parseFeed(feed.url)
    )
  );

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
          }))
          .filter(article => {
            const date = new Date(
              article.date
            ).getTime();

            return (
              !isNaN(date) &&
              date > yesterday
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

        result[
          finalCategory as keyof typeof result
        ].push(article);
      });
    }
  );

  return result;
}
