import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const SOURCE_URL = "https://www.boras.com/evenemang/";
const OUTPUT_PATH = process.env.BORAS_EVENTS_OUTPUT ?? "boras-events-scrape.json";

function stockholmDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return (parts.find(p => p.type === "year")?.value ?? "2000") + "-" +
    (parts.find(p => p.type === "month")?.value ?? "01") + "-" +
    (parts.find(p => p.type === "day")?.value ?? "01");
}
function addDays(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, locale: "sv-SE", timezoneId: "Europe/Stockholm" });
    page.setDefaultTimeout(12_000);
    const response = await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (!response || response.status() >= 400) throw new Error("Borås.com returned HTTP " + (response?.status() ?? "no response"));
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForFunction(() => {
      const text = document.body?.innerText ?? "";
      return !text.includes("Laddar...") || document.querySelectorAll('a[href*="/evenemang/"]').length >= 5;
    }, null, { timeout: 25_000 }).catch(() => {});

    let previousCount = -1;
    let stableRounds = 0;
    for (let round = 0; round < 50 && stableRounds < 5; round++) {
      const showMore = page.getByRole("button", { name: /visa (?:fler|\d+ evenemang)|ladda fler/i }).last();
      if (await showMore.count() && await showMore.isVisible().catch(() => false)) {
        await showMore.click({ timeout: 2_000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(350);
      const count = await page.locator('a[href*="/evenemang/"]').count();
      if (count === previousCount) stableRounds++; else stableRounds = 0;
      previousCount = count;
      if (count > 1_500) break;
    }

    const rawEvents = await page.locator('a[href*="/evenemang/"]').evaluateAll(anchors => {
      const months = {
        januari: 1, jan: 1, februari: 2, feb: 2, mars: 3, mar: 3,
        april: 4, apr: 4, maj: 5, juni: 6, jun: 6, juli: 7, jul: 7,
        augusti: 8, aug: 8, september: 9, sep: 9, oktober: 10, okt: 10,
        november: 11, nov: 11, december: 12, dec: 12,
      };

      function toIsoDate(year, month, day) {
        const y = Number(year), m = Number(month), d = Number(day);
        const date = new Date(Date.UTC(y, m - 1, d));
        if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() !== y ||
            date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
        return String(y).padStart(4, "0") + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
      }

      function parseDates(value) {
        const found = new Set();
        for (const m of value.matchAll(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/g)) {
          const date = toIsoDate(m[1], m[2], m[3]); if (date) found.add(date);
        }
        for (const m of value.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](20\d{2})\b/g)) {
          const date = toIsoDate(m[3], m[2], m[1]); if (date) found.add(date);
        }
        for (const m of value.matchAll(/\b(\d{1,2})[./](\d{1,2})\s+(20\d{2})\b/g)) {
          const date = toIsoDate(m[3], m[2], m[1]); if (date) found.add(date);
        }
        const monthPattern = /\b(\d{1,2})\.?\s+(januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)\s+(20\d{2})\b/gi;
        for (const m of value.matchAll(monthPattern)) {
          const date = toIsoDate(m[3], months[m[2].toLowerCase()], m[1]); if (date) found.add(date);
        }
        const sameMonthRange = /\b(\d{1,2})\s*(?:–|—|-|till)\s*(\d{1,2})\.?\s+(januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)\s+(20\d{2})\b/gi;
        for (const m of value.matchAll(sameMonthRange)) {
          const month = months[m[3].toLowerCase()];
          const first = toIsoDate(m[4], month, m[1]), last = toIsoDate(m[4], month, m[2]);
          if (first) found.add(first); if (last) found.add(last);
        }
        const namedRange = /\b(\d{1,2})\.?\s+(januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)\s*(?:–|—|-|till)\s*(\d{1,2})\.?\s+(januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)\s+(20\d{2})\b/gi;
        for (const m of value.matchAll(namedRange)) {
          const first = toIsoDate(m[5], months[m[2].toLowerCase()], m[1]);
          const last = toIsoDate(m[5], months[m[4].toLowerCase()], m[3]);
          if (first) found.add(first); if (last) found.add(last);
        }
        return [...found].sort();
      }

      return anchors.map(anchor => {
        const url = new URL(anchor.href);
        if (!/^\/evenemang\/[^/?#]+\/?$/.test(url.pathname)) return null;

        // Event date and description often live beside the clickable title/image,
        // not inside the <a>. Walk upward until we find the smallest ancestor
        // containing both meaningful text/date data and a card heading.
        let card = anchor;
        let diagnosticText = "";
        for (let node = anchor, depth = 0; node && depth < 9; node = node.parentElement, depth++) {
          const nodeText = (node.innerText || "").replace(/\s+/g, " ").trim();
          const dateAttributes = [...(node.querySelectorAll?.("time[datetime], [datetime], [data-start-date], [data-date]") ?? [])]
            .map(element => [
              element.getAttribute("datetime") || "",
              element.getAttribute("data-start-date") || "",
              element.getAttribute("data-date") || "",
            ].join(" "))
            .join(" ");
          const combined = nodeText + " " + dateAttributes;
          const dates = parseDates(combined);
          const heading = node.querySelector?.("h1, h2, h3, h4, h5, h6");
          diagnosticText = combined.slice(0, 360);
          if (dates.length && (heading || nodeText.length > 60)) {
            card = node;
            break;
          }
          if (node.matches?.("article, li")) card = node;
        }

        const text = (card.innerText || anchor.innerText || "").replace(/\s+/g, " ").trim();
        const dateAttributes = [...card.querySelectorAll("time[datetime], [datetime], [data-start-date], [data-date]")]
          .map(node => [
            node.getAttribute("datetime") || "",
            node.getAttribute("data-start-date") || "",
            node.getAttribute("data-date") || "",
          ].join(" "))
          .join(" ");
        const combinedDateText = text + " " + dateAttributes;
        const dates = parseDates(combinedDateText);
        const heading = card.querySelector("h1, h2, h3, h4, h5, h6");
        const rawTitle = (heading?.innerText || anchor.innerText || "")
          .replace(/\b20\d{2}[-/]\d{1,2}[-/]\d{1,2}\b/g, " ")
          .replace(/\b\d{1,2}[./]\d{1,2}[./]20\d{2}\b/g, " ")
          .replace(/\b\d{1,2}\s+(?:januari|jan|februari|feb|mars|mar|april|apr|maj|juni|jun|juli|jul|augusti|aug|september|sep|oktober|okt|november|nov|december|dec)\s+20\d{2}\b/gi, " ")
          .replace(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const title = rawTitle.slice(0, 260);
        const times = [...combinedDateText.matchAll(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g)]
          .map(m => String(m[1]).padStart(2, "0") + ":" + m[2]);
        const paragraphs = [...card.querySelectorAll("p")]
          .map(p => (p.innerText || "").replace(/\s+/g, " ").trim())
          .filter(t => t.length > 25);
        const imageNode = card.querySelector("img");
        const venueNode = card.querySelector("[class*='venue'], [class*='location'], [class*='organizer']");
        return {
          title,
          url: url.toString(),
          date: dates[0],
          endDate: dates.length > 1 ? dates[dates.length - 1] : undefined,
          time: times[0],
          venue: (venueNode?.innerText || "").replace(/\s+/g, " ").trim(),
          description: paragraphs[0] || "",
          image: imageNode?.currentSrc || imageNode?.src || imageNode?.getAttribute("data-src") || "",
          debugText: (combinedDateText || diagnosticText).slice(0, 360),
        };
      });
    });

    const today = stockholmDateKey();
    const cutoff = addDays(today, 60);
    const unique = new Map();
    for (const item of rawEvents) {
      if (!item || !item.title || !item.date || !/^20\d{2}-\d{2}-\d{2}$/.test(item.date)) continue;
      if (item.date > cutoff || (item.endDate || item.date) < today) continue;
      if (!item.url.startsWith("https://www.boras.com/evenemang/")) continue;
      if (!unique.has(item.url)) unique.set(item.url, item);
    }
    const events = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99"));
    if (events.length < 6) {
      const sample = rawEvents.filter(Boolean).slice(0, 8).map(item => ({
        title: item.title,
        url: item.url,
        date: item.date,
        debugText: item.debugText,
      }));
      console.error("Borås event extraction diagnostics:", JSON.stringify(sample));
      throw new Error("Only " + events.length + " upcoming event cards extracted. Refusing to replace the last good snapshot. Rendered event links: " + rawEvents.filter(Boolean).length);
    }
    await writeFile(OUTPUT_PATH, JSON.stringify({ sourceUrl: SOURCE_URL, scrapedAt: new Date().toISOString(), events }), "utf8");
    console.log("Borås.com rendered event cards extracted:", events.length);
    console.log("Output written to:", OUTPUT_PATH);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error("Borås.com browser scraping failed:", error); process.exitCode = 1; });
