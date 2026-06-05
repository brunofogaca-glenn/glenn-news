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
  { url: "https://www.bt.se/feeds/section/elfsborg/feed.xml", category: "elfsborg" },
  { url: "http://newsrss.bbc.co.uk/rss/sportonline_uk_edition/football/rss.xml", category: "fotboll" },
  { url: "http://expressen.se/rss/fotboll", category: "fotboll" },
  { url: "http://www.aftonbladet.se/sportbladet/fotboll/rss.xml", category: "fotboll" },
  { url: "http://www.football-italia.net/rss.xml", category: "fotboll" },
  { url: "http://feeds.feedburner.com/redrants", category: "fotboll" },
  { url: "https://feeds.expressen.se/dinapengar/", category: "ekonomi" },
  { url: "https://www.bt.se/feeds/section/boras/feed.xml", category: "boras" },
  { url: "https://www.bt.se/feeds/section/kronikor/feed.xml", category: "livsstil" },
  { url: "https://www.dn.se/rss/om/boras/", category: "boras" },
  { url: "http://www.svt.se/nyheter/ekonomi/rss.xml", category: "ekonomi" },
  { url: "http://www.dn.se/nyheter/sverige/m/rss/senaste-nytt", category: "sverige" },
  { url: "https://www.bt.se/feeds/section/sverige/feed.xml", category: "sverige" },
  { url: "https://api.sr.se/api/rss/program/95", category: "boras" },
  { url: "https://www.bt.se/feeds/section/naringsliv/feed.xml", category: "ekonomi" },
  { url: "http://www.dn.se/ekonomi/m/rss/senaste-nytt", category: "ekonomi" },
  { url: "https://www.avanza.se/placera/forstasidan.rss.xml", category: "ekonomi" },
  { url: "https://www.bt.se/feeds/section/varlden/feed.xml", category: "varlden" },
  { url: "http://www.dn.se/nyheter/varlden/m/rss/senaste-nytt", category: "varlden" },
  { url: "http://newsrss.bbc.co.uk/rss/newsonline_world_edition/front_page/rss.xml", category: "varlden" },
  { url: "https://www.bt.se/feeds/section/kultur-noje/feed.xml", category: "livsstil" },
  { url: "http://www.dn.se/film-rss", category: "livsstil" },
  { url: "http://www.dn.se/musik-rss", category: "livsstil" },
  { url: "https://feeds.expressen.se/sport/vintersport/", category: "sport" },
  { url: "https://feeds.expressen.se/sport/os/", category: "sport" },
  { url: "http://www.vinterstudion.se/feed/", category: "sport" },
  { url: "https://feeds.expressen.se/sport/trav/", category: "sport" }, 
  { url: "http://api.sr.se/api/rssfeed/rssfeed.aspx?rssfeed=179", category: "sport" },
  { url: "http://www.guardian.co.uk/sport/formulaone/rss", category: "sport" },
  { url: "https://feeds.expressen.se/sport/tennis/", category: "tennis" },
  { url: "http://www.dn.se/fotboll-rss", category: "fotboll" },
  { url: "http://www.svt.se/sport/fotboll/rss.xml", category: "fotboll" },
  { url: "http://feeds.guardian.co.uk/theguardian/football/manchester-united/rss", category: "fotboll" },
  { url: "http://www1.skysports.com/feeds/11667/news.xml", category: "fotboll" },  
  { url: "http://www.skysports.com/rss/0,20514,11095,00.xml", category: "sport" },  
  { url: "http://feeds.feedburner.com/sportsblogs/BavarianFootballWorks", category: "fotboll" },
  { url: "http://www.guardian.co.uk/football/bundesligafootball/rss", category: "fotboll" },
  { url: "https://www.marca.com/en/rss/googlenews/football/barcelona.xml", category: "fotboll" },
  { url: "http://www.guardian.co.uk/football/laligafootball/rss", category: "fotboll" },
  { url: "http://www.dn.se/fotboll-rss", category: "fotboll" },
  { url: "http://feeds.guardian.co.uk/theguardian/football/premierleague/rss", category: "fotboll" },
  { url: "https://romapress.net/feed/", category: "fotboll" },
  { url: "http://www.guardian.co.uk/football/serieafootball/rss", category: "fotboll" },
  { url: "http://www.guardian.co.uk/world/sweden/rss", category: "sverige" },
  { url: "http://news.bbc.co.uk/rss/sportonline_world_edition/tennis/rss091.xml", category: "tennis" },
  { url: "http://www.guardian.co.uk/sport/tennis/rss", category: "tennis" },
  { url: "https://feeds.expressen.se/noje/", category: "livsstil" },
  { url: "http://www.dn.se/sport/m/rss/senaste-nytt", category: "sport" },
];

type Article = {
  title: string;
  description: string;
  link: string;
  date: string;
  source: string;
  image: string | null;
};

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
        parser.parseURL(feed.url)
      )
    );

  feeds.forEach(
    (feedResult, index) => {
      const feed = FEEDS[index];

      if (
        feedResult.status !==
        "fulfilled"
      ) {
        console.log(
          `RSS misslyckades: ${feed.url}`
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
