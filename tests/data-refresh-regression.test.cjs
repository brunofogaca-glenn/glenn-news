const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("supplemental refresh and manual editorial recovery use scoped GitHub OIDC", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.ok(!config.crons.some((cron) => cron.path === "/api/cron/refresh-data"));

  const workflow = read(".github/workflows/refresh-supplemental-data.yml");
  assert.match(workflow, /cron: "43 0 \* \* \*"/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(workflow, /audience=\$OIDC_AUDIENCE/);
  assert.match(workflow, /https:\/\/glenn-news\.vercel\.app\/api\/cron\/refresh-data/);
  assert.match(workflow, /VERCEL_AUTOMATION_BYPASS_SECRET/);
  assert.match(workflow, /x-vercel-protection-bypass: \$VERCEL_BYPASS_SECRET/);
  assert.doesNotMatch(workflow, /GITHUB_CRON_SECRET|GLENN_NEWS_REFRESH_URL/);

  const articleWorkflow = read(".github/workflows/refresh-editorial-articles.yml");
  assert.doesNotMatch(articleWorkflow, /cron:/);
  assert.match(articleWorkflow, /workflow_dispatch:/);
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
  assert.match(auth, /workflow === "borasEvents"/);
  assert.match(auth, /payload\.event_name === "push"/);
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

test("scheduled background refreshes are daily and article status is written by the morning job", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.crons.length, 4);
  assert.deepEqual(
    config.crons.map((cron) => cron.schedule).sort(),
    ["30 4 * * *", "30 5 * * *", "34 4 * * *", "34 5 * * *"].sort()
  );
  assert.ok(config.crons.every((cron) => cron.path === "/api/cron/refresh-news"));

  const boras = read(".github/workflows/refresh-boras-events.yml");
  assert.match(boras, /cron: "13 0 \* \* \*"/);
  const fotbollskanalen = read(".github/workflows/refresh-fotbollskanalen-articles.yml");
  assert.match(fotbollskanalen, /cron: "17 1 \* \* \*"/);
  const supplemental = read(".github/workflows/refresh-supplemental-data.yml");
  assert.match(supplemental, /cron: "43 0 \* \* \*"/);

  const editorial = read(".github/workflows/refresh-editorial-articles.yml");
  assert.doesNotMatch(editorial, /cron:/);
  assert.match(editorial, /workflow_dispatch:/);

  const morning = read("app/api/cron/refresh-news/route.ts");
  assert.match(morning, /saveArticleRefreshStatus\(articleStatus\)/);
  assert.match(morning, /previousStatus\?\.status !== "retry"/);
});

test("lifestyle only treats mat as a complete word", () => {
  const category = read("lib/categorizer.ts");
  assert.match(category, /\[\^\\p\{L\}\]\)mat/);
  assert.match(category, /matlagning/);
  assert.match(category, /matkultur/);
});

test("economy category outranks lifestyle and Football Italia is not an RSS source", () => {
  const category = read("lib/categorizer.ts");
  assert.ok(category.indexOf("ECONOMY signals precede lifestyle") < category.indexOf("// KULTUR / MAT / LIVSSTIL"));
  const rss = read("lib/rss.ts");
  assert.doesNotMatch(rss, /https:\/\/football-italia\.net\/feed\//);
});

test("football editorial chooses a shorter top list without league quotas", () => {
  const editor = read("lib/editorV2.ts");
  assert.match(editor, /de största och mest omtalade händelserna från de senaste 24 timmarna/);
  assert.match(editor, /profile, 8\)/);
  assert.doesNotMatch(editor, /Reserve a slot for each named league/);
  assert.doesNotMatch(editor, /function classifyFootballLeague/);
  assert.doesNotMatch(editor, /const groups: SportLeagueGroup\[\]/);
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

test("football league tables use fixed weekday mapping with buffered seasonal overlap windows", () => {
  const sport = read("lib/sportDay.ts");
  assert.match(sport, /swedishLeagues:\s*\{\s*primaryWindow: \[401, 1130\],\s*fallbackWindow: \[1101, 415\]/);
  assert.match(sport, /bigEuropeanLeagues:\s*\{\s*primaryWindow: \[801, 531\],\s*fallbackWindow: \[501, 831\]/);
  assert.match(sport, /championsLeague:\s*\{\s*primaryWindow: \[915, 131\],\s*fallbackWindow: \[201, 1015\]/);
  assert.match(sport, /title: "Allsvenskan"[\s\S]*?title: "Ligue 1"/);
  assert.match(sport, /title: "Superettan"[\s\S]*?title: "Eredivisie"/);
  assert.match(sport, /title: "La Liga"[\s\S]*?fallback: \{ leagueId: 1084, fotmobLeagueId: 169, title: "Ettan Norra"/);
  assert.match(sport, /title: "Premier League"[\s\S]*?fallback: \{ leagueId: 103, fotmobLeagueId: 59, title: "Norska Eliteserien"/);
  assert.match(sport, /title: "Championship"[\s\S]*?fallback: \{ leagueId: 1085, fotmobLeagueId: 169, title: "Ettan Södra"/);
  assert.match(sport, /title: "Serie A"[\s\S]*?fallback: \{ leagueId: 1040, fotmobLeagueId: 9089, title: "Damallsvenskan"/);
  assert.match(sport, /title: "Champions League"[\s\S]*?fallback: \{ leagueId: 128, fotmobLeagueId: 112, title: "Liga Profesional Argentina"/);
  assert.match(sport, /primaryActive \|\| !fallbackActive \? slot\.primary : slot\.fallback/);
  assert.match(sport, /Selection is determined only by the configured date schedule/);
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

test("the selected seasonal table does not change based on provider row availability", () => {
  const sport = read("lib/sportDay.ts");
  const fetcher = sport.slice(sport.indexOf("async function fetchSelectedLeagueTable"), sport.indexOf("function apiFootballErrorText"));
  assert.match(fetcher, /const selected = dailyTableSelection\(\)/);
  assert.match(fetcher, /normalizeFotMobTableRows\(payload\.table, selected\.tableGroup\)/);
  assert.doesNotMatch(fetcher, /for \(const selected of selections\)/);
  assert.doesNotMatch(fetcher, /if \(rows\.length > 0\) \{[\s\S]*?return/);
  assert.match(fetcher, /title: selected\.title/);
  assert.match(fetcher, /isSeasonalFallback: selected\.isSeasonalFallback/);
});


test("saved edition list requests use the Next Data Cache", () => {
  const edition = read("lib/dailyEdition.ts");
  assert.match(edition, /unstable_cache/);
  assert.match(edition, /glenn-news-saved-edition-date-keys-v2/);
  assert.match(edition, /revalidate: 10 \* 60/);
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

test("culture panel shows DN film and album reviews without MovieZine", () => {
  const snapshots = read("lib/dailySnapshots.ts");
  assert.match(snapshots, /DN_FILM_REVIEWS_RSS_URL = "https:\/\/www\.dn\.se\/rss\/om\/filmrecensioner\//);
  assert.match(snapshots, /DN_ALBUM_REVIEWS_RSS_URL = "https:\/\/www\.dn\.se\/rss\/om\/skivrecensioner\//);
  assert.match(snapshots, /function parseReviewRss/);
  assert.match(snapshots, /async function getFilmReviews/);
  assert.match(snapshots, /async function getAlbumReviews/);
  assert.match(snapshots, /filmReviews: SnapshotLink\[\]/);
  assert.match(snapshots, /albumReviews: SnapshotLink\[\]/);
  assert.match(snapshots, /filmReviewSourceUrl: string/);
  assert.match(snapshots, /albumReviewSourceUrl: string/);
  assert.match(snapshots, /const \[filmResult, albumResult\] = await Promise\.allSettled\(\[/);
  assert.match(snapshots, /Array\.isArray\(snapshot\.filmReviews\)/);
  assert.match(snapshots, /Array\.isArray\(snapshot\.albumReviews\)/);
  assert.match(snapshots, /snapshot\.filmReviewSourceUrl/);
  assert.match(snapshots, /snapshot\.albumReviewSourceUrl/);
  assert.match(snapshots, /glenn-news-daily-culture-v5/);
  assert.doesNotMatch(snapshots, /MovieZine|MOVIEZINE_CALENDAR_URL|parseMovieCalendar/);

  const panel = read("app/components/DailySnapshotPanels.tsx");
  assert.match(panel, /Senaste filmrecensionerna/);
  assert.match(panel, /Senaste skivrecensionerna/);
  assert.match(panel, /data\.filmReviews\.slice\(0, 6\)/);
  assert.match(panel, /data\.albumReviews\.slice\(0, 6\)/);
  assert.match(panel, /lg:grid-cols-2/);
  assert.doesNotMatch(panel, /MovieZine|Veckans filmpremiärer/);

  const homepage = read("app/page.tsx");
  assert.match(homepage, /filmReviews: \[\]/);
  assert.match(homepage, /albumReviews: \[\]/);
  assert.match(homepage, /filmReviewSourceUrl: "https:\/\/www\.dn\.se\/rss\/om\/filmrecensioner\//);
  assert.match(homepage, /albumReviewSourceUrl: "https:\/\/www\.dn\.se\/rss\/om\/skivrecensioner\//);
  assert.doesNotMatch(homepage, /moviezine\.se|sourceUrl:/);
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
  assert.ok(workflow.includes('cron: "13 0 * * *"'));
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

test("Fotbollskanalen articles use a rendered-browser feed and validated private ingestion", () => {
  const workflow = read(".github/workflows/refresh-fotbollskanalen-articles.yml");
  assert.ok(workflow.includes('cron: "17 1 * * *"'));
  assert.ok(workflow.includes("playwright install --with-deps chromium"));
  assert.ok(workflow.includes("scripts/scrape-fotbollskanalen-articles.mjs"));
  assert.ok(workflow.includes("/api/cron/ingest-fotbollskanalen-articles"));
  assert.ok(workflow.includes("ACTIONS_ID_TOKEN_REQUEST_URL"));
  assert.ok(workflow.includes("VERCEL_AUTOMATION_BYPASS_SECRET"));
  assert.ok(!workflow.includes("/api/cron/refresh-articles"));

  const scraper = read("scripts/scrape-fotbollskanalen-articles.mjs");
  assert.ok(scraper.includes("chromium.launch"));
  assert.ok(scraper.includes("https://www.fotbollskanalen.se/"));
  assert.ok(scraper.includes("https://www.fotbollskanalen.se/lag/if-elfsborg-herr"));
  assert.ok(scraper.includes("https://www.fotbollskanalen.se/skribent/olof-lundh"));
  assert.ok(scraper.includes('a[href*="/artiklar/"],a[href*="/bloggar/"]'));
  assert.ok(scraper.includes("parsePublishedDate"));
  assert.ok(scraper.includes("refusing to replace the previous snapshot"));

  const store = read("lib/fotbollskanalenArticleStore.ts");
  assert.ok(store.includes('access: "private"'));
  assert.ok(store.includes("MAX_AGE_MS"));
  assert.ok(store.includes("browser-articles.json"));
  assert.ok(store.includes("sourcePages"));

  const ingest = read("app/api/cron/ingest-fotbollskanalen-articles/route.ts");
  assert.ok(ingest.includes('authorizeGitHubActionsRefresh(request, "fotbollskanalenArticles")'));
  assert.ok(ingest.includes("Färre än sex giltiga Fotbollskanalen-artiklar"));
  assert.ok(ingest.includes('revalidateTag("glenn-news-articles"'));
  assert.ok(ingest.includes('revalidateTag("glenn-news-feed-health"'));

  const auth = read("lib/githubActionsAuth.ts");
  assert.ok(auth.includes("refresh-fotbollskanalen-articles.yml"));
  assert.ok(auth.includes('(workflow === "borasEvents" || workflow === "fotbollskanalenArticles" || workflow === "readerHistory") && payload.event_name === "push"'));

  const source = read("lib/webSources.ts");
  assert.ok(source.includes("getBrowserScrapedFotbollskanalenArticles"));
  assert.ok(source.includes('source: "Fotbollskanalen – Senaste"'));
  assert.ok(source.includes("browserSnapshot.articles"));

  const feedHealth = read("lib/feedHealth.ts");
  assert.ok(feedHealth.includes("getBrowserScrapedFotbollskanalenArticles"));
  assert.ok(feedHealth.includes("article.sourcePages.includes(source.url)"));
});


test("culture source inventory matches active DN review feeds", () => {
  const inventory = read("docs/data-refresh-inventory.md");
  assert.match(inventory, /\| `lib\/dailySnapshots\.ts` — culture \| DN film and album review RSS feeds \| 4 hours \|/);
  assert.doesNotMatch(inventory, /MovieZine/i);
});

test("retired helpers and individual-click classification path stay removed", () => {
  const retiredFiles = [
    "lib/ai.ts",
    "lib/morningBrief.ts",
    "lib/editor.ts",
    "lib/topStories.ts",
    "lib/editionMeta.ts",
    "app/api/events/route.ts",
    "lib/articleClassification.ts",
  ];
  for (const file of retiredFiles) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file + " should remain removed");
  }

  const readerProfile = read("lib/readerProfile.ts");
  assert.doesNotMatch(readerProfile, /export async function recordReaderEvent/);
  assert.doesNotMatch(readerProfile, /export async function recordSemanticReaderEvent/);
  assert.ok(fs.existsSync(path.join(root, "app/api/events/batch/route.ts")));
});

test("Vercel build is skipped only for Markdown documentation-only changes", async () => {
  const { shouldIgnoreVercelBuild } = await import("../scripts/vercel-ignore-build.mjs");

  assert.equal(shouldIgnoreVercelBuild(["README.md", "docs/architecture.md"]), true);
  assert.equal(shouldIgnoreVercelBuild(["AGENTS.md", "docs/data-refresh-inventory.md"]), true);
  assert.equal(shouldIgnoreVercelBuild(["lib/readerProfile.ts", "README.md"]), false);
  assert.equal(shouldIgnoreVercelBuild(["vercel.json"]), false);
  assert.equal(shouldIgnoreVercelBuild([".github/run-reader-history-migration"]), false);
  assert.equal(shouldIgnoreVercelBuild([]), false);

  const config = JSON.parse(read("vercel.json"));
  assert.equal(config.ignoreCommand, "node scripts/vercel-ignore-build.mjs");
});

test("recent profile activity reads the ledger before loading legacy event payloads", () => {
  const profile = read("lib/readerProfile.ts");
  const start = profile.indexOf("export async function getRecentReaderActivity(");
  const end = profile.indexOf("export async function getReaderActivitySince(", start);
  const recentActivity = profile.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.ok(recentActivity.indexOf("readReaderHistoryLedger()") < recentActivity.indexOf("list({"));
  assert.match(recentActivity, /oldestBatchTimestamp/);
  assert.match(recentActivity, /timestamp < oldestBatchTimestamp/);
  assert.match(recentActivity, /legacyCandidates\\.map\\(async item/);
});

test("unused create-next-app decorative SVGs stay removed", () => {
  for (const asset of [
    "public/file.svg",
    "public/globe.svg",
    "public/next.svg",
    "public/vercel.svg",
    "public/window.svg",
  ]) {
    assert.equal(fs.existsSync(path.join(root, asset)), false, asset + " should remain deleted");
  }
});
