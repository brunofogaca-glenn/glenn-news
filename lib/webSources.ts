type WebArticle = {
  title: string;
  description: string;
  link: string;
  date: string;
  source: string;
  image: string | null;
  articleType?: string;
};

type WebSourceConfig = {
  url: string;
  domain: string;
  category:
    | "elfsborg"
    | "boras"
    | "sverige"
    | "varlden"
    | "ekonomi"
    | "fotboll"
    | "tennis"
    | "sport"
    | "livsstil";
  source: string;
  defaultArticleType?: string;
};

const WEB_SOURCES: WebSourceConfig[] = [
  {
    url: "https://www.fotbollskanalen.se/lag/if-elfsborg-herr",
    domain: "www.fotbollskanalen.se",
    category: "elfsborg",
    source: "Fotbollskanalen",
  },
  {
    url: "https://www.fotbollskanalen.se/skribent/olof-lundh",
    domain: "www.fotbollskanalen.se",
    category: "fotboll",
    source: "Fotbollskanalen",
  },
  {
    url: "https://www.aftonbladet.se/av/daniel-suhonen",
    domain: "www.aftonbladet.se",
    category: "sverige",
    source: "Aftonbladet",
    defaultArticleType: "krönika",
  },
  {
    url: "https://www.aftonbladet.se/av/andreas-cervenka",
    domain: "www.aftonbladet.se",
    category: "ekonomi",
    source: "Aftonbladet",
    defaultArticleType: "krönika",
  },
];

const MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  mars: 2,
  april: 3,
  maj: 4,
  juni: 5,
  juli: 6,
  augusti: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"' )
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCharCode(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    );
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUrl(href: string, baseUrl: string) {
  try {
    return new URL(decodeHtml(href), baseUrl).toString();
  } catch {
    return "";
  }
}

function isArticleUrl(url: string, source: WebSourceConfig) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname !== source.domain) {
      return false;
    }

    if (source.domain === "www.fotbollskanalen.se") {
      return (
        parsed.pathname.includes("/artiklar/") ||
        parsed.pathname.includes("/bloggar/")
      );
    }

    if (source.domain === "www.aftonbladet.se") {
      return /\/a\/[A-Za-z0-9]/.test(parsed.pathname);
    }

    return false;
  } catch {
    return false;
  }
}

function extractImage(html: string, baseUrl: string) {
  const match = html.match(
    /<(?:img|source)\b[^>]*(?:src|data-src|data-lazy-src)=["\']([^"\']+)["\']/i
  );

  if (!match?.[1]) {
    return null;
  }

  const value = match[1]
    .split(",")[0]
    .trim()
    .split(/\s+/)[0];

  return resolveUrl(value, baseUrl) || null;
}

function parsePublishedDate(context: string, now = new Date()) {
  const clean = stripTags(context).toLowerCase();

  const iso = clean.match(
    /\b(20\d{2}-\d{2}-\d{2}(?:[t ][0-9:.+-]+z?)?)\b/
  )?.[1];

  if (iso) {
    const parsed = new Date(iso);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (/\bidag\b|\bjust nu\b|\bnyss\b/.test(clean)) {
    return now.toISOString();
  }

  if (/\bi går\b/.test(clean)) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date.toISOString();
  }

  const match = clean.match(
    /\b(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\b/
  );

  if (!match) {
    return "";
  }

  const day = Number(match[1]);
  const month = MONTHS[match[2]];
  const year =
    month > now.getMonth()
      ? now.getFullYear() - 1
      : now.getFullYear();

  const parsed = new Date(year, month, day, 12, 0, 0);

  if (isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString();
}

function cleanTitle(value: string) {
  return value
    .replace(
      /^(?:idag|i går|\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december))\s*(?:\d{1,2}[.:]\d{2})?\s*(?:krönika|ledare|kolumn|min ekonomi)?\s*/i,
      ""
    )
    .replace(/^\s+|\s+$/g, "")
    .trim();
}

function inferArticleType(context: string, fallback?: string) {
  const clean = stripTags(context).toLowerCase();

  if (clean.includes("krönika")) return "krönika";
  if (clean.includes("ledare")) return "kommentar";
  if (clean.includes("kolumn")) return "krönika";
  if (clean.includes("analys")) return "analys";
  if (clean.includes("reportage")) return "reportage";
  if (clean.includes("intervju")) return "intervju";

  return fallback;
}

function extractArticles(html: string, source: WebSourceConfig) {
  const results: WebArticle[] = [];
  const seen = new Set<string>();
  const anchorPattern =
    /<a\b[^>]*\bhref=["\']([^"\']+)["\'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const href = resolveUrl(match[1], source.url);

    if (!href || !isArticleUrl(href, source)) continue;

    const title = cleanTitle(
      stripTags(match[2])
    );

    if (
      !title ||
      title.length < 12 ||
      title.length > 240 ||
      seen.has(href)
    ) {
      continue;
    }

    const start = Math.max(0, match.index - 1200);
    const end = Math.min(html.length, anchorPattern.lastIndex + 1200);
    const context = html.slice(start, end);

    seen.add(href);

    results.push({
      title,
      description: "",
      link: href,
      date: parsePublishedDate(context),
      source: source.source,
      image: extractImage(context, source.url),
      articleType: inferArticleType(context, source.defaultArticleType),
    });
  }

  return results;
}

async function fetchWebSource(source: WebSourceConfig) {
  const response = await fetch(source.url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Glenn News/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(
      String(response.status) + " " + response.statusText
    );
  }

  const html = await response.text();
  return extractArticles(html, source);
}

export async function getWebArticles() {
  const results = {
    elfsborg: [] as WebArticle[],
    boras: [] as WebArticle[],
    sverige: [] as WebArticle[],
    varlden: [] as WebArticle[],
    ekonomi: [] as WebArticle[],
    fotboll: [] as WebArticle[],
    tennis: [] as WebArticle[],
    sport: [] as WebArticle[],
    livsstil: [] as WebArticle[],
  };

  const fetched = await Promise.allSettled(
    WEB_SOURCES.map(fetchWebSource)
  );

  fetched.forEach((result, index) => {
    if (result.status !== "fulfilled") {
      console.error(
        "Webbkälla misslyckades:",
        WEB_SOURCES[index].url,
        result.reason
      );
      return;
    }

    results[WEB_SOURCES[index].category].push(...result.value);
  });

  return results;
}
