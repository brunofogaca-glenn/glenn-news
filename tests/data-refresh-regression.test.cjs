const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("supplemental and editorial cron workflows use scoped GitHub OIDC", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.ok(!config.crons.some((cron) => cron.path === "/api/cron/refresh-data"));

  const workflow = read(".github/workflows/refresh-supplemental-data.yml");
  assert.match(workflow, /cron: "3,33 \* \* \* \*"/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(workflow, /audience=\$OIDC_AUDIENCE/);
  assert.match(workflow, /https:\/\/glenn-news\.vercel\.app\/api\/cron\/refresh-data/);
  assert.match(workflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(workflow, /x-vercel-protection-bypass: \$VERCEL_BYPASS_SECRET/);
  assert.doesNotMatch(workflow, /GITHUB_CRON_SECRET|GLENN_NEWS_REFRESH_URL/);

  const articleWorkflow = read(".github/workflows/refresh-editorial-articles.yml");
  assert.match(articleWorkflow, /cron: "3,33 \* \* \* \*"/);
  assert.match(articleWorkflow, /id-token: write/);
  assert.match(articleWorkflow, /ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(articleWorkflow, /https:\/\/glenn-news\.vercel\.app\/api\/cron\/refresh-articles/);
  assert.match(articleWorkflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(articleWorkflow, /x-vercel-protection-bypass: \$VERCEL_BYPASS_SECRET/);
  assert.doesNotMatch(articleWorkflow, /GITHUB_CRON_SECRET|GLENN_NEWS_ARTICLE_REFRESH_URL/);

  const auth = read("lib/githubActionsAuth.ts");
  assert.match(auth, /createRemoteJWKSet/);
  assert.match(auth, /jwtVerify/);
  assert.match(auth, /payload\.repository === REPOSITORY/);
  assert.match(auth, /payload\.ref === MAIN_REF/);
  assert.match(auth, /payload\.workflow_ref === ALLOWED_WORKFLOWS\[workflow\]/);
  assert.match(auth, /workflow === "borasEvents" && payload\.event_name === "push"/);
  assert.match(auth, /payload\.repository === REPOSITORY/);
  assert.match(auth, /payload\.ref === MAIN_REF/);

  const articleRoute = read("app/api/cron/refresh-articles/route.ts");
  assert.match(articleRoute, /authorizeGitHubActionsRefresh\(request, "editorial"\)/);
  assert.match(articleRoute, /canRefreshEditorialSourcesNow\(\)/);
  assert.match(articleRoute, /RETRY_MS/);
  assert.match(articleRoute, /getArticleRefreshStatus/);

  const route = read("app/api/cron/refresh-data/route.ts");
  assert.match(route, /authorizeGitHubActionsRefresh\(request, "supplemental"\)/);
  assert.match(route, /if \(clock\.hour < 1\)/);
  assert.match(route, /articleFeedsTouched: false/);
  assert.doesNotMatch(route, /getCachedArticles|getCachedFeedHealth|getArticles\(/);
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

test("quote feature is removed from the homepage", () => {
  const homepage = read("app/page.tsx");
  assert.doesNotMatch(homepage, /QuoteDivider|quotes\.ts/);
  assert.ok(!fs.existsSync(path.join(root, "app/components/QuoteDivider.tsx")));
  assert.ok(!fs.existsSync(path.join(root, "lib/quotes.ts")));
});

test("league tables show season-scoped zones and explain provisional European places", () => {
  const zones = read("lib/leagueZones.ts");
  assert.match(zones, /Allsvenskan:[\s\S]*?seasonStart: 2026/);
  assert.match(zones, /Superettan:[\s\S]*?fromRank: 13, toRank: 14/);
  assert.match(zones, /Championship:[\s\S]*?fromRank: 22, toRank: 24/);
  assert.ok(zones.includes('"Champions League":'));
  assert.ok(zones.includes("fromRank: 25, toRank: 36"));
  assert.match(zones, /confirmed: false/);
  assert.match(zones, /if \(!match \|\| Number\(match\[0\]\) !== config\.seasonStart\) return null/);

  const panel = read("app/components/SportDayPanel.tsx");
  assert.match(panel, /getZoneForRank/);
  assert.match(panel, /Så tolkas strecken/);
  assert.match(panel, /zoneConfig\.note/);
});

test("reader profile uses semantic interests rather than raw article topics", () => {
  const profile = read("app/profil/page.tsx");
  assert.match(profile, /profile\.semanticTopic/);
  assert.match(profile, /profile\.semanticTag/);
  assert.match(profile, /profile\.semanticClicks/);
  assert.match(profile, /profile\.entity/);
  assert.doesNotMatch(profile, /const topicEntries = topEntries\(profile\.topic/);
  assert.match(profile, /Vad artiklarna handlar om/);
  assert.match(profile, /Lag, personer och platser/);
});

test("supplemental status is persisted and readable from the operations page", () => {
  const route = read("app/api/cron/refresh-data/route.ts");
  assert.match(route, /saveSupplementalRefreshRun\(report\)/);
  const storage = read("lib/supplementalRefreshRun.ts");
  assert.match(storage, /getSupplementalRefreshRun/);
  const health = read("app/health/page.tsx");
  assert.match(health, /getSupplementalRefreshRun/);
  assert.match(health, /Nattlig uppdatering/);
});

test("culture panel shows DN album reviews alongside weekly movie premieres", () => {
  const snapshots = read("lib/dailySnapshots.ts");
  assert.match(snapshots, /DN_ALBUM_REVIEWS_RSS_URL = "https:\/\/www\.dn\.se\/rss\/om\/skivrecensioner\//);
  assert.match(snapshots, /function parseAlbumReviewsRss/);
  assert.match(snapshots, /async function getAlbumReviews/);
  assert.match(snapshots, /albumReviews: SnapshotLink\[\]/);
  assert.match(snapshots, /reviewSourceUrl: string/);
  assert.match(snapshots, /const \[movieResult, reviewResult\] = await Promise\.allSettled\(\[/);
  assert.match(snapshots, /Array\.isArray\(snapshot\.albumReviews\)/);
  assert.match(snapshots, /snapshot\.reviewSourceUrl/);
  assert.match(snapshots, /glenn-news-daily-culture-v4/);

  const panel = read("app/components/DailySnapshotPanels.tsx");
  assert.match(panel, /Veckans filmpremiärer/);
  assert.match(panel, /Senaste skivrecensionerna/);
  assert.match(panel, /data\.albumReviews\.slice\(0, 6\)/);
  assert.match(panel, /lg:grid-cols-2/);

  const homepage = read("app/page.tsx");
  assert.match(homepage, /albumReviews: \[\]/);
  assert.match(homepage, /reviewSourceUrl: "https:\/\/www\.dn\.se\/rss\/om\/skivrecensioner\//);
});

test("Borås local events prioritize reader interests and keep Borås Stad events separate", () => {
  const snapshots = read("lib/dailySnapshots.ts");
  assert.match(snapshots, /parseJsonLdEvents\(borasHtml\.value, LOCAL_EVENTS_URL\)/);
  assert.match(snapshots, /meetings = calendarItems\.filter\(item => item\.kind === "sammanträde"\)/);
  assert.doesNotMatch(snapshots, /events = dedupeEntries\(\[[\s\S]{0,150}calendarItems\.filter\(item => item\.kind !== "sammanträde"\)/);
  assert.match(snapshots, /events: events\.sort\(\(a, b\) =>/);
  assert.doesNotMatch(snapshots, /events: events\.sort\(\(a, b\) =>[\s\S]{0,180}\.slice\(0, 5\)/);
  assert.match(snapshots, /local-snapshot-v5/);
  assert.match(snapshots, /glenn-news-daily-local-v5/);

  const panel = read("app/components/DailySnapshotPanels.tsx");
  assert.match(panel, /function rankLocalEvents\(events: LocalSnapshot\["events"\], profile: ReaderProfile\)/);
  assert.match(panel, /profile\.semanticTopic/);
  assert.match(panel, /profile\.semanticTag/);
  assert.match(panel, /profile\.entity/);
  assert.match(panel, /orgelfestival/);
  assert.match(panel, /Evenemang från Borås\.com, prioriterade efter dina läsintressen/);
  assert.match(panel, /rankLocalEvents\(data\.events, profile\)\.slice\(0, 4\)/);

  const homepage = read("app/page.tsx");
  assert.match(homepage, /LocalSnapshotPanel data=\{localSnapshot\} profile=\{profile\}/);
});

test("Borås events use an explicit public-event fallback when Borås.com has no structured listing", () => {
  const snapshots = read("lib/dailySnapshots.ts");
  assert.match(snapshots, /eventSource: "boras.com" \| "boras-stad-fallback"/);
  assert.match(snapshots, /if \(events\.length < 4 && publicCityEvents\.length > 0\)/);
  assert.match(snapshots, /events = publicCityEvents/);
  assert.match(snapshots, /eventSource = "boras-stad-fallback"/);
  assert.match(snapshots, /boras-stad-fallback/);
  assert.match(snapshots, /glenn-news-daily-local-v5/);

  const panel = read("app/components/DailySnapshotPanels.tsx");
  assert.match(panel, /Borås.com-listan gick inte att läsa just nu/);
  assert.match(panel, /Evenemang: Borås Stad \(reservkälla\)/);

  const homepage = read("app/page.tsx");
  assert.match(homepage, /eventSource: "boras.com" as const/);
});

test("Borås events are captured with a real browser and loaded from private cached snapshots", () => {
  const workflow = read(".github/workflows/refresh-boras-events.yml");
  assert.ok(workflow.includes('cron: "23 */2 * * *"'));
  assert.ok(workflow.includes("playwright install --with-deps chromium"));
  assert.ok(workflow.includes("scripts/scrape-boras-events.mjs"));
  assert.ok(workflow.includes("/api/cron/ingest-boras-events"));
  assert.ok(!workflow.includes("/api/cron/refresh-data"));
  assert.ok(workflow.includes("invalidate the local snapshot cache"));
  assert.ok(workflow.includes("ACTIONS_ID_TOKEN_REQUEST_URL"));
  assert.ok(workflow.includes("VERCEL_AUTOMATION_BYPASS_SECRET"));

  const scraper = read("scripts/scrape-boras-events.mjs");
  assert.ok(scraper.includes("chromium.launch"));
  assert.ok(scraper.includes('waitForLoadState("networkidle"'));
  assert.ok(scraper.includes('a[href*="/evenemang/"]'));
  assert.ok(scraper.includes("node = node.parentElement"));
  assert.ok(scraper.includes("function parseDates(value)"));
  assert.ok(scraper.includes("sameMonthRange"));
  assert.ok(scraper.includes("Borås event extraction diagnostics"));
  assert.ok(scraper.includes("Refusing to replace the last good snapshot"));

  const store = read("lib/borasEventStore.ts");
  assert.ok(store.includes('access: "private"'));
  assert.ok(store.includes("MAX_AGE_MS"));
  assert.ok(store.includes("browser-scrape.json"));

  const ingest = read("app/api/cron/ingest-boras-events/route.ts");
  assert.ok(ingest.includes('authorizeGitHubActionsRefresh(request, "borasEvents")'));
  assert.ok(ingest.includes("Färre än sex kommande Borås-evenemang"));
  assert.ok(ingest.includes('revalidateTag("glenn-news-daily-local"'));

  const auth = read("lib/githubActionsAuth.ts");
  assert.ok(auth.includes("refresh-boras-events.yml"));

  const snapshots = read("lib/dailySnapshots.ts");
  assert.ok(snapshots.includes("getBrowserScrapedBorasEvents"));
  assert.ok(snapshots.includes("glenn-news-daily-local-v5"));
  assert.ok(snapshots.includes("scrapedEvents.length >= 6"));
});
