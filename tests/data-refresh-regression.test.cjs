const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("supplemental cron runs every half hour and skips before 01:00 Stockholm", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.ok(!config.crons.some((cron) => cron.path === "/api/cron/refresh-data"));
  const workflow = read(".github/workflows/refresh-supplemental-data.yml");
  assert.match(workflow, /cron: "3,33 \* \* \* \*"/);
  assert.match(workflow, /GITHUB_CRON_SECRET/);
  const route = read("app/api/cron/refresh-data/route.ts");
  assert.match(route, /if \(clock\.hour < 1\)/);
  assert.match(route, /articleFeedsTouched: false/);
  assert.doesNotMatch(route, /getCachedArticles|getCachedFeedHealth|getArticles\(/);
  assert.ok(route.includes("GITHUB_CRON_SECRET"));
  assert.ok(!route.includes("user-agent"));

  const snapshots = read("lib/supplementalCache.ts");
  assert.ok(snapshots.includes("warningsOf(value)"));
  assert.ok(snapshots.includes('status: "stale"'));
});

test("editorial sources are gated until 06:00", () => {
  const schedule = read("lib/updateSchedule.ts");
  assert.match(schedule, /hour >= 6/);

  const rss = read("lib/rss.ts");
  assert.ok(rss.includes("RSS-hämtning är spärrad före 06.00"));
  assert.ok(rss.includes("Artikelhämtning är spärrad före 06.00"));

  const webSources = read("lib/webSources.ts");
  assert.ok(webSources.includes("Hämtning av artikelwebbkällor är spärrad före 06.00"));

  const feedHealthSource = read("lib/feedHealth.ts");
  assert.ok(feedHealthSource.includes("Kontroll av artikelkällor är spärrad före 06.00"));

  const homepage = read("app/page.tsx");
  assert.match(homepage, /canRefreshEditorialSourcesNow\(\)[\s\S]{0,120}\? withOptionalFallback\("feed health"/);

  const healthPage = read("app/health/page.tsx");
  assert.match(healthPage, /const health = editorialSourcesAllowed[\s\S]{0,80}\? await getFeedHealth\(\)/);

  const actions = read("app/actions.ts");
  assert.ok(actions.includes("Morgonutgåvan kan inte återskapas före 06.00"));
  assert.match(actions, /editorialSourcesAllowed\s+\?\s+\["glenn-news-articles", "glenn-news-feed-health"/);
  assert.ok(actions.includes('...(editorialSourcesAllowed ? [getCachedArticles(), getCachedFeedHealth()] : []),'));
});

test("sports data no longer triggers editorial article ingestion", () => {
  const sport = read("lib/sportDay.ts");
  assert.doesNotMatch(sport, /getCachedArticles|articlesCache/);
});

test("morning edition generation has a guard before fetching articles", () => {
  const edition = read("lib/dailyEdition.ts");
  const generationStart = edition.indexOf("export async function generateMorningEdition");
  const guard = edition.indexOf("if (!canRefreshEditorialSourcesNow())", generationStart);
  const fetch = edition.indexOf("const news = await getCachedArticles()", generationStart);
  assert.ok(generationStart >= 0, "generator should exist");
  assert.ok(guard > generationStart, "06:00 guard should be in the generator");
  assert.ok(fetch > guard, "guard must precede any article cache fetch");
});
