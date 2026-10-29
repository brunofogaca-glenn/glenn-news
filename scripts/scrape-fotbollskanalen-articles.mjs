import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const OUTPUT_PATH = process.env.FOTBOLLSKANALEN_OUTPUT ?? "fotbollskanalen-articles.json";
const SOURCES = [
  { url: "https://www.fotbollskanalen.se/", category: "fotboll" },
  { url: "https://www.fotbollskanalen.se/lag/if-elfsborg-herr", category: "elfsborg" },
  { url: "https://www.fotbollskanalen.se/skribent/olof-lundh", category: "fotboll" },
];
const ARTICLE_PATH = /^\/(?:artiklar|bloggar)\//;
const MAX_ARTICLES_PER_PAGE = 80;
const MAX_ARTICLE_STALENESS_MS = 72 * 60 * 60 * 1000;

function stockholmDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  return (parts.find(part => part.type === "year")?.value ?? "2000") + "-" +
    (parts.find(part => part.type === "month")?.value ?? "01") + "-" +
    (parts.find(part => part.type === "day")?.value ?? "01");
}

function stockholmTimestamp(dateText, timeText) {
  const [year, month, day] = dateText.split("-").map(Number);
  const [hour, minute] = (timeText || "12:00").split(":").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const zoneLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm", timeZoneName: "shortOffset", hour: "2-digit",
  }).formatToParts(probe).find(part => part.type === "timeZoneName")?.value ?? "GMT+1";
  const match = zoneLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  const offset = match
    ? match[1] + String(match[2]).padStart(2, "0") + ":" + String(match[3] ?? "00").padStart(2, "0")
    : "+01:00";
  return new Date(dateText + "T" + String(hour).padStart(2, "0") + ":" +
    String(minute).padStart(2, "0") + ":00" + offset).toISOString();
}

function parsePublishedDate(text, dateAttributes = [], now = new Date()) {
  for (const value of dateAttributes) {
    if (!value) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp) && timestamp <= now.getTime() + 5 * 60 * 1000) {
      return new Date(timestamp).toISOString();
    }
    const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})(?:[T ](\d{1,2}:\d{2}))?/);
    if (iso) return stockholmTimestamp(iso[1], iso[2]);
  }

  const value = (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})(?:[t ](\d{1,2}:\d{2})(?::\d{2})?)?/);
  if (iso) return stockholmTimestamp(iso[1], iso[2]);

  if (/\b(i dag|idag|just nu|nyss)\b/.test(value)) return now.toISOString();

  const monthNumbers = {
    januari: 1, jan: 1, februari: 2, feb: 2, mars: 3, mar: 3,
    april: 4, apr: 4, maj: 5, juni: 6, jun: 6, juli: 7, jul: 7,
    augusti: 8, aug: 8, september: 9, sep: 9, oktober: 10, okt: 10,
    november: 11, nov: 11, december: 12, dec: 12,
  };
  const stockholmToday = stockholmDateKey(now);
  const [todayYear, todayMonth] = stockholmToday.split("-").map(Number);

  const todayTime = value.match(/\bdatum\s+([01]?\d|2[0-3]):([0-5]\d)\b/i);
  if (todayTime) return stockholmTimestamp(stockholmToday, todayTime[1].padStart(2, "0") + ":" + todayTime[2]);

  const yesterday = /\b(i går|igår)\b/.test(value);
  if (yesterday) {
    const date = new Date(stockholmToday + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - 1);
    return stockholmTimestamp(date.toISOString().slice(0, 10), "12:00");
  }

  const namedDate = value.match(/\b(\d{1,2})\.?\s+(januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)(?:\s+(20\d{2}))?\b/);
  if (!namedDate) return "";

  const day = Number(namedDate[1]);
  const month = monthNumbers[namedDate[2]];
  const year = namedDate[3]
    ? Number(namedDate[3])
    : month > todayMonth ? todayYear - 1 : todayYear;
  const date = String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  const parsed = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return "";
  return stockholmTimestamp(date, "12:00");
}

function inferArticleType(text) {
  const clean = (text || "").toLowerCase();
  if (clean.includes("krönika") || clean.includes("kolumn")) return "krönika";
  if (clean.includes("ledare")) return "kommentar";
  if (clean.includes("analys")) return "analys";
  if (clean.includes("reportage")) return "reportage";
  if (clean.includes("intervju")) return "intervju";
  return undefined;
}

async function scrapeSource(browser, source) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
  });
  page.setDefaultTimeout(12_000);

  try {
    const response = await page.goto(source.url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    if (!response || response.status() >= 400) {
      throw new Error("Fotbollskanalen returned HTTP " + (response?.status() ?? "no response") + " for " + source.url);
    }

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await page.waitForFunction(() =>
      document.querySelectorAll('a[href*="/artiklar/"],a[href*="/bloggar/"]').length >= 5 ||
      !(document.body?.innerText ?? "").includes("Laddar..."),
    null, { timeout: 25_000 }).catch(() => {});

    let previousCount = -1;
    let stableRounds = 0;
    for (let round = 0; round < 12 && stableRounds < 3; round++) {
      const showMore = page.getByRole("button", { name: /visa fler|ladda fler|fler artiklar|visa alla/i }).last();
      if (await showMore.count() && await showMore.isVisible().catch(() => false)) {
        await showMore.click({ timeout: 2_000 }).catch(() => {});
        await page.waitForTimeout(250);
      }
      const count = await page.locator('a[href*="/artiklar/"],a[href*="/bloggar/"]').count();
      if (count === previousCount) stableRounds++; else stableRounds = 0;
      previousCount = count;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      if (count > 1_000) break;
    }

    return await page.locator('a[href*="/artiklar/"],a[href*="/bloggar/"]').evaluateAll((anchors, sourceInfo) => {
      const now = new Date();
      const monthNumbers = {
        januari: 1, jan: 1, februari: 2, feb: 2, mars: 3, mar: 3,
        april: 4, apr: 4, maj: 5, juni: 6, jun: 6, juli: 7, jul: 7,
        augusti: 8, aug: 8, september: 9, sep: 9, oktober: 10, okt: 10,
        november: 11, nov: 11, december: 12, dec: 12,
      };
      function dayKey(date = new Date()) {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
        }).formatToParts(date);
        return (parts.find(part => part.type === "year")?.value ?? "2000") + "-" +
          (parts.find(part => part.type === "month")?.value ?? "01") + "-" +
          (parts.find(part => part.type === "day")?.value ?? "01");
      }
      function makeTimestamp(dateText, timeText) {
        const [year, month, day] = dateText.split("-").map(Number);
        const [hour, minute] = (timeText || "12:00").split(":").map(Number);
        const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));
        const zoneLabel = new Intl.DateTimeFormat("en-US", {
          timeZone: "Europe/Stockholm", timeZoneName: "shortOffset", hour: "2-digit",
        }).formatToParts(probe).find(part => part.type === "timeZoneName")?.value ?? "GMT+1";
        const offsetMatch = zoneLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
        const offset = offsetMatch
          ? offsetMatch[1] + String(offsetMatch[2]).padStart(2, "0") + ":" + String(offsetMatch[3] ?? "00").padStart(2, "0")
          : "+01:00";
        return new Date(dateText + "T" + String(hour).padStart(2, "0") + ":" +
          String(minute).padStart(2, "0") + ":00" + offset).toISOString();
      }
      function parseDate(context, attrs) {
        for (const raw of attrs) {
          if (!raw) continue;
          const parsed = Date.parse(raw);
          if (Number.isFinite(parsed) && parsed <= now.getTime() + 5 * 60 * 1000) return new Date(parsed).toISOString();
          const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})(?:[T ](\d{1,2}:\d{2}))?/);
          if (iso) return makeTimestamp(iso[1], iso[2]);
        }
        const text = (context || "").replace(/\s+/g, " ").trim().toLowerCase();
        const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})(?:[t ](\d{1,2}:\d{2})(?::\d{2})?)?/);
        if (iso) return makeTimestamp(iso[1], iso[2]);
        if (/\b(i dag|idag|just nu|nyss)\b/.test(text)) return now.toISOString();
        const today = dayKey();
        const todayTime = text.match(/\bdatum\s+([01]?\d|2[0-3]):([0-5]\d)\b/i);
        if (todayTime) return makeTimestamp(today, todayTime[1].padStart(2, "0") + ":" + todayTime[2]);
        if (/\b(i går|igår)\b/.test(text)) {
          const date = new Date(today + "T12:00:00Z");
          date.setUTCDate(date.getUTCDate() - 1);
          return makeTimestamp(date.toISOString().slice(0, 10), "12:00");
        }
        const named = text.match(/\b(\d{1,2})\.?\s+(januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)(?:\s+(20\d{2}))?\b/);
        if (!named) return "";
        const month = monthNumbers[named[2]], day = Number(named[1]);
        const todayParts = today.split("-").map(Number);
        const year = named[3] ? Number(named[3]) : month > todayParts[1] ? todayParts[0] - 1 : todayParts[0];
        const dateText = String(year).padStart(4, "0") + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
        const parsed = new Date(dateText + "T12:00:00Z");
        if (!Number.isFinite(parsed.getTime()) || parsed.getUTCFullYear() !== year ||
            parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return "";
        return makeTimestamp(dateText, "12:00");
      }

      function textOf(node) {
        return (node?.innerText || "").replace(/\s+/g, " ").trim();
      }

      const output = [];
      const seen = new Set();
      for (const anchor of anchors) {
        let url;
        try { url = new URL(anchor.href); } catch { continue; }
        if (!["www.fotbollskanalen.se", "fotbollskanalen.se"].includes(url.hostname.toLowerCase()) ||
            !/^\/(?:artiklar|bloggar)\//.test(url.pathname)) continue;

        let card = anchor;
        let publishedAt = "";
        let cardText = textOf(anchor);
        for (let node = anchor, depth = 0; node && depth < 9; node = node.parentElement, depth++) {
          const text = textOf(node);
          const attrs = [...(node.querySelectorAll?.("time[datetime], [datetime], [data-published-at], [data-date]") ?? [])]
            .flatMap(element => [
              element.getAttribute("datetime") || "",
              element.getAttribute("data-published-at") || "",
              element.getAttribute("data-date") || "",
            ]);
          const combined = text + " " + attrs.join(" ");
          const parsed = parseDate(combined, attrs);
          if (parsed && (node.querySelector?.("h1,h2,h3,h4,h5,h6") || text.length > 25) && text.length < 2_500) {
            card = node;
            cardText = text;
            publishedAt = parsed;
            break;
          }
        }

        if (!publishedAt) {
          const attrs = [...card.querySelectorAll("time[datetime], [datetime], [data-published-at], [data-date]")]
            .flatMap(element => [
              element.getAttribute("datetime") || "",
              element.getAttribute("data-published-at") || "",
              element.getAttribute("data-date") || "",
            ]);
          publishedAt = parseDate(textOf(card), attrs);
        }

        const heading = card.querySelector("h1,h2,h3,h4,h5,h6");
        const titleText = textOf(anchor) || textOf(heading);
        const title = titleText
          .replace(/\bdatum\s+[01]?\d:[0-5]\d\b/ig, " ")
          .replace(/\b(?:krönika|analys|intervju|reportage)\b/ig, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!title || title.length < 12 || title.length > 240 || !publishedAt || seen.has(url.toString())) continue;
        seen.add(url.toString());

        const paragraphs = [...card.querySelectorAll("p")]
          .map(node => textOf(node))
          .filter(value => value.length > 35 && value !== title);
        const imageNode = card.querySelector("img");
        const typeText = cardText + " " + title;
        let articleType;
        if (/krönika|kolumn/i.test(typeText)) articleType = "krönika";
        else if (/ledare/i.test(typeText)) articleType = "kommentar";
        else if (/analys/i.test(typeText)) articleType = "analys";
        else if (/reportage/i.test(typeText)) articleType = "reportage";
        else if (/intervju/i.test(typeText)) articleType = "intervju";

        output.push({
          title,
          url: url.toString(),
          date: publishedAt,
          description: paragraphs[0]?.slice(0, 900) || "",
          image: imageNode?.currentSrc || imageNode?.src || imageNode?.getAttribute("data-src") || "",
          category: sourceInfo.category,
          articleType,
          sourcePages: [sourceInfo.url],
        });
        if (output.length >= 150) break;
      }
      return output.slice(0, 80);
    }, source);
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const byUrl = new Map();
    const errors = [];
    for (const source of SOURCES) {
      try {
        const articles = await scrapeSource(browser, source);
        console.log("Fotbollskanalen browser source:", source.url, "articles:", articles.length);
        for (const raw of articles) {
          const existing = byUrl.get(raw.url);
          if (!existing) {
            byUrl.set(raw.url, raw);
            continue;
          }
          existing.sourcePages = [...new Set([...existing.sourcePages, ...raw.sourcePages])];
          if (raw.category === "elfsborg") existing.category = "elfsborg";
          existing.description = existing.description || raw.description;
          existing.image = existing.image || raw.image;
          existing.articleType = existing.articleType || raw.articleType;
        }
      } catch (error) {
        errors.push({ source: source.url, message: error instanceof Error ? error.message : String(error) });
        console.error("Fotbollskanalen source scrape failed:", source.url, errors[errors.length - 1].message);
      }
    }

    const now = Date.now();
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    const articles = [...byUrl.values()]
      .filter(item => {
        const timestamp = Date.parse(item.date);
        return item.title && Number.isFinite(timestamp) &&
          timestamp >= cutoff && timestamp <= now + 5 * 60 * 1000;
      })
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

    console.log("Fotbollskanalen browser scrape total unique recent articles:", articles.length);
    if (articles.length < 6) {
      const sample = [...byUrl.values()].slice(0, 12).map(item => ({
        title: item.title,
        url: item.url,
        date: item.date,
        sourcePages: item.sourcePages,
      }));
      console.error("Fotbollskanalen extraction diagnostics:", JSON.stringify({ errors, sample }));
      throw new Error("Only " + articles.length + " recent articles extracted; refusing to replace the previous snapshot.");
    }

    const newestArticleAt = Date.parse(articles[0]?.date ?? "");
    if (!Number.isFinite(newestArticleAt) || now - newestArticleAt > MAX_ARTICLE_STALENESS_MS) {
      const sample = articles.slice(0, 6).map(item => ({
        title: item.title,
        url: item.url,
        date: item.date,
        sourcePages: item.sourcePages,
      }));
      const ageHours = Number.isFinite(newestArticleAt)
        ? Math.round((now - newestArticleAt) / (60 * 60 * 1000))
        : null;
      console.error("Fotbollskanalen freshness diagnostics:", JSON.stringify({ errors, ageHours, sample }));
      throw new Error(
        "Newest valid Fotbollskanalen article is older than 72 hours (" +
        (ageHours ?? "unknown") + "h); refusing to replace the previous snapshot."
      );
    }

    await writeFile(OUTPUT_PATH, JSON.stringify({
      scrapedAt: new Date().toISOString(),
      articleCount: articles.length,
      articles,
    }), "utf8");
    console.log("Output written to:", OUTPUT_PATH);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error("Fotbollskanalen browser scrape failed:", error);
  process.exitCode = 1;
});
