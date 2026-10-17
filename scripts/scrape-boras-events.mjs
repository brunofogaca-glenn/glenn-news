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

    const rawEvents = await page.locator('a[href*="/evenemang/"]').evaluateAll(anchors =>
      anchors.map(anchor => {
        const url = new URL(anchor.href);
        if (!/^\/evenemang\/[^/?#]+\/?$/.test(url.pathname)) return null;
        const card = anchor.closest("article, li") || anchor;
        const text = (card.innerText || "").replace(/\s+/g, " ").trim();
        const heading = card.querySelector("h1, h2, h3, h4, h5");
        const title = (heading?.innerText || "").replace(/\s+/g, " ").trim();
        const dates = [...new Set([
          ...[...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map(m => m[1]),
          ...[...card.querySelectorAll("time[datetime], [datetime]")].map(node => {
            const m = (node.getAttribute("datetime") || "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
            return m ? m[1] : "";
          }).filter(Boolean),
        ])].sort();
        const times = [...text.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)]
          .map(m => String(m[1]).padStart(2, "0") + ":" + m[2]);
        const paragraphs = [...card.querySelectorAll("p")].map(p => (p.innerText || "").replace(/\s+/g, " ").trim()).filter(t => t.length > 25);
        const imageNode = card.querySelector("img");
        const venueNode = card.querySelector("[class*='venue'], [class*='location'], [class*='organizer']");
        return {
          title,
          url: url.toString(),
          date: dates[0],
          endDate: dates.length > 1 ? dates[1] : undefined,
          time: times[0],
          venue: (venueNode?.innerText || "").replace(/\s+/g, " ").trim(),
          description: paragraphs[0] || "",
          image: imageNode?.currentSrc || imageNode?.src || imageNode?.getAttribute("data-src") || "",
        };
      })
    );

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
