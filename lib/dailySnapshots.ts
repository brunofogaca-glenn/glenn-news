import { unstable_cache } from "next/cache";

const TIME_ZONE = "Europe/Stockholm";

export type SnapshotLink = {
  title: string;
  url: string;
  date?: string;
  dateLabel?: string;
  time?: string;
  description?: string;
  kind?: string;
};

export type LocalSnapshot = {
  events: SnapshotLink[];
  meetings: SnapshotLink[];
  updatedAt: string;
  sources: Array<{ title: string; url: string }>;
};

export type NationalSnapshot = {
  agenda: SnapshotLink[];
  news: SnapshotLink[];
  updatedAt: string;
  sources: Array<{ title: string; url: string }>;
};

export type WorldMarketIndicator = {
  symbol: string;
  name: string;
  value: number;
  unit: string;
  changePct?: number;
  date: string;
  source: string;
  url: string;
};

export type WorldRate = {
  name: string;
  value: number;
  date: string;
  detail: string;
  source: string;
  url: string;
};

export type WorldGdp = {
  country: string;
  code: string;
  value: number;
  year: string;
};

export type WorldSnapshot = {
  markets: WorldMarketIndicator[];
  rates: WorldRate[];
  gdp: WorldGdp[];
  updatedAt: string;
  warnings: string[];
};

export type CultureSnapshot = {
  films: SnapshotLink[];
  updatedAt: string;
  sourceUrl: string;
};

const LOCAL_EVENTS_URL = "https://www.boras.com/evenemang/";
const BORAS_CALENDAR_URL = "https://www.boras.se/kalender.4.42986d2b155b56f853336753.html";
const RIKSDAG_NEWS_URL = "https://www.riksdagen.se/sv/aktuellt/";
const RIKSDAG_AGENDA_URL = "https://www.riksdagen.se/sv/dokument-och-lagar/dokument/uttag/planerade-arenden-for-kammaren_h6d1plan/";
const MOVIEZINE_CALENDAR_URL = "https://www.moviezine.se/kalender";

const MONTHS: Record<string, number> = {
  januari: 1, jan: 1, februari: 2, feb: 2, mars: 3, mar: 3,
  april: 4, apr: 4, maj: 5, juni: 6, jun: 6, juli: 7, jul: 7,
  augusti: 8, aug: 8, september: 9, sep: 9, oktober: 10, okt: 10,
  november: 11, nov: 11, december: 12, dec: 12,
};

function todayInStockholm() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find(part => part.type === "year")?.value ?? "2000";
  const month = parts.find(part => part.type === "month")?.value ?? "01";
  const day = parts.find(part => part.type === "day")?.value ?? "01";
  return year + "-" + month + "-" + day;
}

function addDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.getUTCFullYear() + "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(date.getUTCDate()).padStart(2, "0");
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, number: string) => String.fromCodePoint(parseInt(number, 16)));
}

function htmlText(value: string) {
  return decodeHtml(value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\r\n\t]+/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function normalizeDate(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) return null;
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function parseDateFromText(value: string, allowNoYear = false): string | null {
  const text = htmlText(value);

  const iso = text.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return normalizeDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dotted = text.match(/\b(\d{1,2})\.(\d{1,2})\.(20\d{2})\b/);
  if (dotted) return normalizeDate(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));

  const monthPattern = /\b(\d{1,2})\s+(januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)(?:\s+(20\d{2}))?\b/i;
  const monthDate = text.match(monthPattern);
  if (!monthDate) return null;

  const month = MONTHS[monthDate[2].toLowerCase()];
  if (!month) return null;

  let year = monthDate[3] ? Number(monthDate[3]) : Number(todayInStockholm().slice(0, 4));
  let candidate = normalizeDate(year, month, Number(monthDate[1]));
  if (!candidate) return null;

  if (allowNoYear && !monthDate[3] && candidate < todayInStockholm()) {
    year += 1;
    candidate = normalizeDate(year, month, Number(monthDate[1]));
  }

  return candidate;
}

function dateLabel(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function extractTime(value: string) {
  const match = htmlText(value).match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
  return match ? String(match[1]).padStart(2, "0") + ":" + match[2] : undefined;
}

function absoluteUrl(href: string, baseUrl: string) {
  try {
    const url = new URL(decodeHtml(href.trim()), baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function anchorsInHtml(block: string, baseUrl: string) {
  const anchors: Array<{ title: string; url: string }> = [];
  const pattern = /<a\b([^>]*?)href\s*=\s*(?:"([^"]+)"|'([^']+)')([^>]*)>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(block)) !== null) {
    const href = match[2] ?? match[3] ?? "";
    const url = absoluteUrl(href, baseUrl);
    const title = htmlText(match[5] ?? "");
    if (!url || !title || title.length > 240) continue;
    if (url.includes("facebook.com") || url.includes("instagram.com") || url.includes("linkedin.com")) continue;
    anchors.push({ title, url });
  }
  return anchors;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Glenn-News/1.0; daily context)",
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("HTTP " + response.status + " for " + url);
  return response.text();
}

function removeDateFromTitle(value: string) {
  return htmlText(value)
    .replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g, "")
    .replace(/\b\d{1,2}\.\d{1,2}\.20\d{2}\b/g, "")
    .replace(/\b\d{1,2}\s+(januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)(\s+20\d{2})?\b/gi, "")
    .replace(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g, "")
    .replace(/\s+/g, " ").replace(/^[·|,\-\s]+|[·|,\-\s]+$/g, "").trim();
}

function parseCityCalendar(html: string) {
  const today = todayInStockholm();
  const cutoff = addDays(today, 30);
  const blocks: string[] = [];
  const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = liPattern.exec(html)) !== null) blocks.push(match[1]);

  const entries: SnapshotLink[] = [];
  for (const block of blocks) {
    const text = htmlText(block);
    const date = parseDateFromText(text);
    if (!date || date < today || date > cutoff) continue;

    const links = anchorsInHtml(block, BORAS_CALENDAR_URL);
    const usefulLink = links.find(link =>
      link.title.length >= 4 &&
      !/^(läs mer|öppna|kalender|till innehåll|film|bild|mer information)$/i.test(link.title)
    );
    if (!usefulLink) continue;

    const title = removeDateFromTitle(usefulLink.title);
    if (!title || title.length < 4) continue;
    const time = extractTime(text);
    entries.push({
      title,
      url: usefulLink.url,
      date,
      dateLabel: dateLabel(date),
      time,
      description: text.length > usefulLink.title.length
        ? text.replace(usefulLink.title, "").slice(0, 190).trim()
        : undefined,
      kind: /sammanträde|nämnd|kommunstyrelsen|fullmäktige/i.test(text) ? "sammanträde" : "evenemang",
    });
  }

  return dedupeEntries(entries).sort((a, b) =>
    (a.date ?? "").localeCompare(b.date ?? "") ||
    (a.time ?? "99:99").localeCompare(b.time ?? "")
  );
}

function collectJsonEvents(value: unknown, baseUrl: string, target: SnapshotLink[]) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonEvents(item, baseUrl, target);
    return;
  }

  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]];
  if (
    types.some(type => String(type).toLowerCase() === "event") &&
    typeof record["name"] === "string" &&
    typeof record["startDate"] === "string"
  ) {
    const date = parseDateFromText(String(record["startDate"]));
    const url = typeof record["url"] === "string"
      ? absoluteUrl(record["url"], baseUrl)
      : baseUrl;
    if (date && url) {
      target.push({
        title: String(record["name"]),
        url,
        date,
        dateLabel: dateLabel(date),
        time: extractTime(String(record["startDate"])),
        description: typeof record["description"] === "string"
          ? String(record["description"]).slice(0, 180)
          : undefined,
        kind: "evenemang",
      });
    }
  }

  for (const [key, child] of Object.entries(record)) {
    if (key === "image" || key === "logo") continue;
    if (child && typeof child === "object") collectJsonEvents(child, baseUrl, target);
  }
}

function parseJsonLdEvents(html: string, baseUrl: string) {
  const events: SnapshotLink[] = [];
  const scripts = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scripts.exec(html)) !== null) {
    try {
      collectJsonEvents(JSON.parse(match[1]), baseUrl, events);
    } catch {
      // Ignore invalid structured-data blocks and continue with the other sources.
    }
  }

  const today = todayInStockholm();
  const cutoff = addDays(today, 30);
  return dedupeEntries(events.filter(item => item.date && item.date >= today && item.date <= cutoff));
}

function dedupeEntries(entries: SnapshotLink[]) {
  const seen = new Set<string>();
  return entries.filter(item => {
    const key = (item.date ?? "") + "|" + item.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getLocalSnapshotInternal(): Promise<LocalSnapshot> {
  const [borasHtml, calendarHtml] = await Promise.allSettled([
    fetchHtml(LOCAL_EVENTS_URL),
    fetchHtml(BORAS_CALENDAR_URL),
  ]);

  let events: SnapshotLink[] = [];
  let meetings: SnapshotLink[] = [];

  if (borasHtml.status === "fulfilled") {
    events = parseJsonLdEvents(borasHtml.value, LOCAL_EVENTS_URL);
  }
  if (calendarHtml.status === "fulfilled") {
    const calendarItems = parseCityCalendar(calendarHtml.value);
    meetings = calendarItems.filter(item => item.kind === "sammanträde").slice(0, 3);
    events = dedupeEntries([
      ...events,
      ...calendarItems.filter(item => item.kind !== "sammanträde"),
    ]);
  }

  return {
    events: events.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).slice(0, 5),
    meetings,
    updatedAt: new Date().toISOString(),
    sources: [
      { title: "Borås.com · evenemang", url: LOCAL_EVENTS_URL },
      { title: "Borås Stad · kalender", url: BORAS_CALENDAR_URL },
    ],
  };
}

function parseDateHeadingBlocks(html: string, baseUrl: string) {
  const headings: Array<{ date: string; text: string; end: number }> = [];
  const pattern = /<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const text = htmlText(match[1]);
    const date = parseDateFromText(text, true);
    if (date && /\b(20\d{2}|\d{1,2}\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december))/i.test(text)) {
      headings.push({ date, text, end: pattern.lastIndex });
    }
  }

  const today = todayInStockholm();
  return headings
    .map((heading, index) => {
      const nextStart = headings[index + 1]?.end
        ? html.lastIndexOf("<h", headings[index + 1].end)
        : Math.min(html.length, heading.end + 5000);
      const section = html.slice(heading.end, nextStart > heading.end ? nextStart : Math.min(html.length, heading.end + 5000));
      const links = anchorsInHtml(section, baseUrl).filter(link =>
        !/^(till innehåll|lättläst|teckenspråk|in english|dokument & lagar|aktuellt|start)$/i.test(link.title)
      );

      return {
        date: heading.date,
        title: heading.text,
        url: links[0]?.url ?? baseUrl,
        dateLabel: heading.text.replace(/\s+20\d{2}\b/, "").trim(),
        description: links.slice(0, 3).map(link => link.title).join(" · ") ||
          (section.toLowerCase().includes("inga ärenden") ? "Inga ärenden inplanerade." : undefined),
        _today: today,
      };
    })
    .filter(item => item.date >= today)
    .map(({ _today: _unused, ...item }) => item);
}

function parseRiksdagNews(html: string) {
  const entries: SnapshotLink[] = [];
  const pattern = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const titleAnchor = anchorsInHtml(match[1], RIKSDAG_NEWS_URL)[0];
    if (!titleAnchor || titleAnchor.title.length < 8) continue;
    if (!titleAnchor.url.includes("/sv/aktuellt/")) continue;

    const body = html.slice(pattern.lastIndex, Math.min(html.length, pattern.lastIndex + 1800));
    const cleaned = htmlText(body);
    const description = cleaned.slice(0, 220).trim();
    entries.push({
      title: titleAnchor.title,
      url: titleAnchor.url,
      description: description.length > 24 ? description : undefined,
    });
    if (entries.length >= 4) break;
  }

  return dedupeEntries(entries);
}

async function getNationalSnapshotInternal(): Promise<NationalSnapshot> {
  const [agendaHtml, newsHtml] = await Promise.allSettled([
    fetchHtml(RIKSDAG_AGENDA_URL),
    fetchHtml(RIKSDAG_NEWS_URL),
  ]);

  const agenda = agendaHtml.status === "fulfilled"
    ? parseDateHeadingBlocks(agendaHtml.value, RIKSDAG_AGENDA_URL).slice(0, 5)
    : [];
  const news = newsHtml.status === "fulfilled"
    ? parseRiksdagNews(newsHtml.value)
    : [];

  return {
    agenda,
    news,
    updatedAt: new Date().toISOString(),
    sources: [
      { title: "Riksdagen · planerade ärenden", url: RIKSDAG_AGENDA_URL },
      { title: "Riksdagen · aktuellt", url: RIKSDAG_NEWS_URL },
    ],
  };
}

function parseMovieCalendar(html: string) {
  const today = todayInStockholm();
  const cutoff = addDays(today, 10);
  const headings: Array<{ date: string; end: number }> = [];
  const headingPattern = /<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(html)) !== null) {
    const text = htmlText(match[1]);
    const date = parseDateFromText(text);
    if (date && /\b\d{1,2}\.\d{1,2}\.20\d{2}\b/.test(text)) {
      headings.push({ date, end: headingPattern.lastIndex });
    }
  }

  const films: SnapshotLink[] = [];
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index];
    if (heading.date < today || heading.date > cutoff) continue;

    const nextHeadingStart = headings[index + 1]
      ? html.lastIndexOf("<h", headings[index + 1].end)
      : Math.min(html.length, heading.end + 10000);
    const section = html.slice(heading.end, nextHeadingStart > heading.end ? nextHeadingStart : Math.min(html.length, heading.end + 10000));
    const anchors = anchorsInHtml(section, MOVIEZINE_CALENDAR_URL).filter(link =>
      /\/film\/|\/filmer\/|\/kalender\//i.test(new URL(link.url).pathname)
    );

    for (const link of anchors) {
      if (link.title.length < 2 || link.title.length > 120) continue;
      if (/^(kalender|film|serier|nyheter|recensioner|topplistor)$/i.test(link.title)) continue;
      films.push({
        title: link.title,
        url: link.url,
        date: heading.date,
        dateLabel: dateLabel(heading.date),
      });
    }
  }

  return dedupeEntries(films).sort((a, b) =>
    (a.date ?? "").localeCompare(b.date ?? "") || a.title.localeCompare(b.title)
  ).slice(0, 5);
}

async function getCultureSnapshotInternal(): Promise<CultureSnapshot> {
  let films: SnapshotLink[] = [];
  try {
    films = parseMovieCalendar(await fetchHtml(MOVIEZINE_CALENDAR_URL));
  } catch (error) {
    console.error("MovieZine-kalendern kunde inte hämtas:", error);
  }

  return {
    films,
    updatedAt: new Date().toISOString(),
    sourceUrl: MOVIEZINE_CALENDAR_URL,
  };
}

type YahooSparkResult = {
  symbol?: string;
  response?: Array<{
    timestamp?: number[];
    indicators?: { quote?: Array<{ close?: Array<number | null> }> };
  }>;
};

function formatTimestampDate(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp * 1000));
  const year = parts.find(part => part.type === "year")?.value ?? "0000";
  const month = parts.find(part => part.type === "month")?.value ?? "00";
  const day = parts.find(part => part.type === "day")?.value ?? "00";
  return year + "-" + month + "-" + day;
}

async function getWorldMarkets(): Promise<WorldMarketIndicator[]> {
  const symbols = [
    { symbol: "BZ=F", name: "Brentolja", unit: "USD/fat", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/BZ=F/" },
    { symbol: "USDSEK=X", name: "USD/SEK", unit: "SEK", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/USDSEK=X/" },
    { symbol: "EURSEK=X", name: "EUR/SEK", unit: "SEK", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/EURSEK=X/" },
    { symbol: "GBPSEK=X", name: "GBP/SEK", unit: "SEK", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/GBPSEK=X/" },
    { symbol: "^VIX", name: "VIX", unit: "index", source: "Yahoo Finance", url: "https://finance.yahoo.com/quote/%5EVIX/" },
  ];

  const url = new URL("https://query1.finance.yahoo.com/v7/finance/spark");
  url.searchParams.set("symbols", symbols.map(item => item.symbol).join(","));
  url.searchParams.set("range", "1mo");
  url.searchParams.set("interval", "1d");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Glenn-News/1.0)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Yahoo Finance HTTP " + response.status);

  const payload = await response.json() as { spark?: { result?: YahooSparkResult[] } };
  const rows = payload.spark?.result ?? [];
  if (!rows.length) throw new Error("Yahoo Finance returnerade inga marknadsdata.");

  const cutoff = todayInStockholm();
  const output: WorldMarketIndicator[] = [];

  for (const target of symbols) {
    const item = rows.find(result => result.symbol === target.symbol);
    const responseData = item?.response?.[0];
    if (!responseData) continue;

    const timestamps = responseData.timestamp ?? [];
    const closes = responseData.indicators?.quote?.[0]?.close ?? [];
    const valid = timestamps
      .map((timestamp, index) => ({
        date: formatTimestampDate(timestamp),
        timestamp,
        close: closes[index],
      }))
      .filter(row => row.date < cutoff && row.close != null && Number.isFinite(Number(row.close)))
      .sort((a, b) => b.timestamp - a.timestamp);

    const latest = valid[0];
    const previous = valid[1];
    if (!latest || latest.close == null) continue;

    const value = Number(latest.close);
    const changePct = previous?.close != null && Number(previous.close) !== 0
      ? (value / Number(previous.close) - 1) * 100
      : undefined;

    output.push({
      symbol: target.symbol,
      name: target.name,
      value,
      unit: target.unit,
      changePct,
      date: latest.date,
      source: target.source,
      url: target.url,
    });
  }

  return output;
}

function findObservation(value: unknown): { value: number; date: string } | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index--) {
      const found = findObservation(value[index]);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const rawValue = record.value ?? record.Value ?? record.rate ?? record.Rate;
  const rawDate = record.date ?? record.Date ?? record.observationDate ?? record.ObservationDate;
  const parsedValue = typeof rawValue === "number"
    ? rawValue
    : typeof rawValue === "string"
      ? Number(rawValue.replace(",", "."))
      : NaN;

  if (Number.isFinite(parsedValue) && rawDate) {
    return { value: parsedValue, date: String(rawDate).slice(0, 10) };
  }
  for (const child of Object.values(record)) {
    if (child && typeof child === "object") {
      const found = findObservation(child);
      if (found) return found;
    }
  }
  return null;
}

async function getRiksbankPolicyRate(): Promise<WorldRate> {
  const url = "https://api.riksbank.se/swea/v1/Observations/Latest/secbrepoeff";
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Riksbankens API HTTP " + response.status);
  const observation = findObservation(await response.json());
  if (!observation) throw new Error("Riksbankens API returnerade ingen styrränta.");

  return {
    name: "Sverige",
    value: observation.value,
    date: observation.date,
    detail: "Riksbankens styrränta",
    source: "Sveriges Riksbank",
    url: "https://www.riksbank.se/sv/statistik/rantor-och-valutakurser/hamta-rantor-och-valutakurser-via-api/",
  };
}

async function getFredRate(seriesId: string, name: string, detail: string, url: string): Promise<WorldRate> {
  const response = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + encodeURIComponent(seriesId), {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "text/csv,text/plain" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("FRED HTTP " + response.status + " för " + seriesId);

  const csv = await response.text();
  const lines = csv.trim().split(/\r?\n/).slice(1).reverse();
  for (const line of lines) {
    const parts = line.split(",");
    const date = parts[0]?.trim();
    const value = Number(parts[1]?.trim());
    if (date && Number.isFinite(value)) {
      return {
        name,
        value,
        date,
        detail,
        source: "FRED",
        url,
      };
    }
  }
  throw new Error("FRED returnerade ingen ränta för " + seriesId);
}

type WorldBankObservation = {
  country?: { value?: string };
  countryiso3code?: string;
  date?: string;
  value?: number | null;
};

async function getWorldGdp(): Promise<WorldGdp[]> {
  const url = new URL("https://api.worldbank.org/v2/country/SWE;USA;GBR;DEU;CHN;JPN/indicator/NY.GDP.MKTP.KD.ZG");
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("mrv", "4");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("World Bank API HTTP " + response.status);

  const payload = await response.json() as [unknown, WorldBankObservation[]?];
  const observations = payload[1] ?? [];
  const countries = new Map<string, WorldGdp>();
  for (const item of observations) {
    if (!item.countryiso3code || !item.date || item.value == null) continue;
    const old = countries.get(item.countryiso3code);
    if (!old || Number(item.date) > Number(old.year)) {
      countries.set(item.countryiso3code, {
        country: item.country?.value ?? item.countryiso3code,
        code: item.countryiso3code,
        value: item.value,
        year: item.date,
      });
    }
  }
  return [...countries.values()].sort((a, b) => {
    const preferred = ["SWE", "USA", "GBR", "DEU", "CHN", "JPN"];
    return preferred.indexOf(a.code) - preferred.indexOf(b.code);
  });
}

async function getWorldSnapshotInternal(): Promise<WorldSnapshot> {
  const settled = await Promise.allSettled([
    getWorldMarkets(),
    getRiksbankPolicyRate(),
    getFredRate("DFEDTARU", "USA", "Fed · övre målintervall", "https://fred.stlouisfed.org/series/DFEDTARU"),
    getFredRate("ECBDFR", "Euroområdet", "ECB · inlåningsränta", "https://fred.stlouisfed.org/series/ECBDFR"),
    getWorldGdp(),
  ]);

  const markets = settled[0].status === "fulfilled" ? settled[0].value : [];
  const rates: WorldRate[] = [];
  if (settled[1].status === "fulfilled") rates.push(settled[1].value);
  if (settled[2].status === "fulfilled") rates.push(settled[2].value);
  if (settled[3].status === "fulfilled") rates.push(settled[3].value);
  const gdp = settled[4].status === "fulfilled" ? settled[4].value : [];

  const warnings: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      const labels = ["marknader", "Riksbanken", "Fed", "ECB", "BNP"];
      warnings.push(labels[index] + ": " + (result.reason instanceof Error ? result.reason.message : "data kunde inte hämtas"));
    }
  });

  return {
    markets,
    rates,
    gdp,
    updatedAt: new Date().toISOString(),
    warnings,
  };
}

const getCachedLocalSnapshotInternal = unstable_cache(
  getLocalSnapshotInternal,
  ["glenn-news-daily-local-v1"],
  { revalidate: 4 * 60 * 60, tags: ["glenn-news-daily-local"] }
);

const getCachedNationalSnapshotInternal = unstable_cache(
  getNationalSnapshotInternal,
  ["glenn-news-daily-national-v1"],
  { revalidate: 2 * 60 * 60, tags: ["glenn-news-daily-national"] }
);

const getCachedCultureSnapshotInternal = unstable_cache(
  getCultureSnapshotInternal,
  ["glenn-news-daily-culture-v1"],
  { revalidate: 12 * 60 * 60, tags: ["glenn-news-daily-culture"] }
);

const getCachedWorldSnapshotInternal = unstable_cache(
  getWorldSnapshotInternal,
  ["glenn-news-daily-world-v1"],
  { revalidate: 6 * 60 * 60, tags: ["glenn-news-daily-world"] }
);

export function getCachedLocalSnapshot() {
  return getCachedLocalSnapshotInternal();
}

export function getCachedNationalSnapshot() {
  return getCachedNationalSnapshotInternal();
}

export function getCachedCultureSnapshot() {
  return getCachedCultureSnapshotInternal();
}

export function getCachedWorldSnapshot() {
  return getCachedWorldSnapshotInternal();
}
