const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

// The production ranker is TypeScript. Transpile it on demand so these
// regression tests use the real implementation without adding a test runner.
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { rankArticles } = require("../lib/ranker.ts");
const { detectCategory } = require("../lib/categorizer.ts");
const { isSlowResponse, summarizeResponseTimes, prioritizeHealthFeeds, SLOW_RESPONSE_THRESHOLD_MS } = require("../lib/feedHealthMetrics.ts");

function emptyProfile() {
  return {
    category: {},
    articleType: {},
    source: {},
    topic: {},
    semanticCategory: {},
    semanticArticleType: {},
    semanticTopic: {},
    semanticTag: {},
    entity: {},
    geography: {},
    eventKey: {},
    semanticClicks: 0,
    totalClicks: 0,
    lastUpdated: null,
  };
}

function article(overrides = {}) {
  return {
    title: "En vanlig nyhet",
    description: "",
    source: "Nyhetsbyrån",
    link: "https://example.com/story",
    date: new Date().toISOString(),
    articleType: "nyhet",
    ...overrides,
  };
}

test("football stories cannot leak into lifestyle through source labels or the word stem vin", () => {
  const headline = {
    title: "Analysen efter Blåvitt–Djurgården: Firandet hade han kunnat skippa",
    description: "Expressens analys efter 1–1 mellan IFK Göteborg och Djurgården.",
    source: "Expressen: Fotboll",
  };
  assert.equal(detectCategory(headline), "fotboll");

  assert.notEqual(
    detectCategory({
      title: "Vinnaren firas efter finalen",
      description: "Spelaren vinner igen.",
    }),
    "livsstil",
    "the word stem 'vin' inside 'vinner' must not classify a football/general story as lifestyle"
  );

  assert.equal(
    detectCategory({ title: "Vin till helgens middag", description: "Tips om vinval." }),
    "livsstil",
    "a genuine wine topic should still be classified as lifestyle"
  );
});

test("major public-interest news gets a signal without click history", () => {
  const [ranked] = rankArticles([
    article({
      title: "Jordbävning orsakar flera dödsoffer och katastrofläge utlyses",
    }),
  ]);

  assert.equal(ranked.publicImportanceScore, 27);
  // "jordbävning" is also a fixed interest term, so allow fixed scoring here.
  assert.ok(ranked.personalizationScore <= 42);
  assert.ok(Number.isFinite(ranked.newsScore));
  assert.ok(Number.isFinite(ranked.score));
});

test("combined personalization is capped even for a strong existing profile", () => {
  const profile = {
    ...emptyProfile(),
    category: { elfsborg: 100 },
    articleType: { "krönika": 100 },
    source: { "borås tidning": 100 },
    topic: { "besfort zeneli": 100 },
    semanticArticleType: { "krönika": 100 },
    semanticTopic: { "besfort zeneli": 100 },
    semanticTag: { allsvenskan: 100 },
    entity: { "if elfsborg": 100 },
    geography: { borås: 100 },
    eventKey: { "transfernyheter": 100 },
    semanticClicks: 100,
    totalClicks: 100,
  };

  const [ranked] = rankArticles([
    article({
      title: "Krönika: IF Elfsborg, Besfort Zeneli och Allsvenskan i Borås",
      source: "Borås Tidning",
      articleType: "krönika",
    }),
  ], profile);

  assert.equal(ranked.personalizationScore, 55);
  assert.ok(ranked.personalizationScore <= 55);
  assert.ok(Number.isFinite(ranked.score));
});

test("a labelled column outranks a generic news brief on reading depth", () => {
  const ranked = rankArticles([
    article({
      title: "Krönika: Därför behöver Elfsborg tänka om",
      articleType: "nyhet",
      link: "https://example.com/column",
    }),
    article({
      title: "Klubben presenterar sin trupp inför nästa match",
      articleType: "nyhet",
      link: "https://example.com/brief",
    }),
  ]);

  const column = ranked.find(item => item.link.endsWith("/column"));
  const brief = ranked.find(item => item.link.endsWith("/brief"));

  assert.ok(column);
  assert.ok(brief);
  assert.ok(column.readingScore > brief.readingScore);
  assert.equal(column.readingScore, 100);
  assert.equal(brief.readingScore, 30);
});

test("ranking preserves every input story and returns finite scores", () => {
  const stories = [
    article({ title: "Riksbanken ändrar styrräntan", link: "https://example.com/rate" }),
    article({ title: "Elfsborg förbereder sig inför Allsvenskan", link: "https://example.com/elfsborg" }),
    article({ title: "Ny intervju med tränaren", articleType: "intervju", link: "https://example.com/interview" }),
  ];

  const ranked = rankArticles(stories);

  assert.equal(ranked.length, stories.length);
  assert.equal(new Set(ranked.map(item => item.link)).size, stories.length);
  assert.ok(ranked.every(item => Number.isFinite(item.score) && Number.isFinite(item.newsScore)));
});

test("widely covered topic scores more strongly than one-source routine news without unbounded source multiplication", () => {
  const popular = [
    article({ title: "Club confirms major manager departure after late-night talks", source: "Outlet A", link: "https://a.example.com/story" }),
    article({ title: "Club confirms major manager departure after late-night talks", source: "Outlet B", link: "https://b.example.com/story" }),
    article({ title: "Club confirms major manager departure after late-night talks", source: "Outlet C", link: "https://c.example.com/story" }),
  ];
  const routine = article({
    title: "Local team prepares for routine training session",
    source: "Single source",
    link: "https://routine.example.com/story",
  });
  const ranked = rankArticles([...popular, routine]);
  const popularScores = ranked.filter(item => item.title === popular[0].title);
  const routineRanked = ranked.find(item => item.link === routine.link);
  assert.ok(popularScores.every(item => item.uniqueSources >= 3));
  assert.ok(popularScores.every(item => item.newsScore > routineRanked.newsScore));
  assert.ok(popularScores.every(item => item.score < 400), "the echo signal should remain bounded");
});

test("optional homepage source caches refresh on demand and use shorter freshness windows", () => {
  const snapshots = fs.readFileSync(require.resolve("../lib/dailySnapshots.ts"), "utf8");
  const actions = fs.readFileSync(require.resolve("../app/actions.ts"), "utf8");

  assert.match(snapshots, /revalidate:\s*2\s*\*\s*60\s*\*\s*60,\s*tags:\s*\["glenn-news-daily-local"\]/);
  assert.match(snapshots, /revalidate:\s*60\s*\*\s*60,\s*tags:\s*\["glenn-news-daily-national"\]/);
  assert.match(snapshots, /revalidate:\s*4\s*\*\s*60\s*\*\s*60,\s*tags:\s*\["glenn-news-daily-culture"\]/);
  assert.match(snapshots, /revalidate:\s*3\s*\*\s*60\s*\*\s*60,\s*tags:\s*\["glenn-news-daily-world"\]/);

  for (const tag of [
    "glenn-news-daily-local", "glenn-news-daily-national", "glenn-news-daily-culture",
    "glenn-news-daily-world", "glenn-news-weather", "glenn-news-daily-header",
  ]) {
    assert.ok(actions.includes(tag), `manual refresh invalidates ${tag}`);
  }
  for (const source of [
    "getCachedLocalSnapshot()", "getCachedNationalSnapshot()", "getCachedCultureSnapshot()",
    "getCachedWorldSnapshot()", "getCachedWeather()", "getDailyHeaderInfo()",
  ]) {
    assert.ok(actions.includes(source), `manual refresh fetches ${source}`);
  }
  assert.ok(actions.includes("morningEditionChanged: false"));
});

test("feed health metrics separate slow responses from source failures and prioritize actionable issues", () => {
  const feeds = [
    { name: "snabb", status: "ok", responseMs: 100 },
    { name: "gräns", status: "ok", responseMs: SLOW_RESPONSE_THRESHOLD_MS },
    { name: "långsam", status: "ok", responseMs: 8_000 },
    { name: "inaktuell", status: "stale", responseMs: 900 },
    { name: "fel", status: "error", responseMs: 200 },
    { name: "tom", status: "empty", responseMs: 300 },
  ];

  const metrics = summarizeResponseTimes(feeds);
  assert.equal(isSlowResponse(2_499), false);
  assert.equal(isSlowResponse(2_500), true);
  assert.equal(metrics.slow, 2);
  assert.equal(metrics.slowThresholdMs, 2_500);
  assert.equal(metrics.averageResponseMs, 2_000);
  assert.equal(metrics.medianResponseMs, 600);

  const ordered = prioritizeHealthFeeds(feeds);
  assert.deepEqual(ordered.map(feed => feed.name), [
    "fel", "inaktuell", "tom", "långsam", "gräns", "snabb",
  ]);
  assert.equal(ordered.find(feed => feed.name === "långsam").status, "ok",
    "slow timing is a separate signal and does not turn a healthy source into an error");
});

test("production morning edition contract keeps Stockholm scheduling, validation, retries and fallback messaging aligned", () => {
  const schedules = JSON.parse(fs.readFileSync(require.resolve("../vercel.json"), "utf8")).crons;
  assert.deepEqual(
    schedules.map(cron => [cron.path, cron.schedule]),
    [
      ["/api/cron/refresh-news", "30 4 * * *"],
      ["/api/cron/refresh-news", "34 4 * * *"],
      ["/api/cron/refresh-news", "30 5 * * *"],
      ["/api/cron/refresh-news", "34 5 * * *"],
      ["/api/cron/refresh-data", "13 0 * * *"],
      ["/api/cron/refresh-data", "13 1 * * *"],
      ["/api/cron/process-reader-history", "15 1,2 * * *"],
      ["/api/cron/refresh-browser-sources", "13 2,3 * * *"],
    ],
    "UTC schedules cover the whole 06:00–06:59 Stockholm hour in both CET and CEST, with two possible attempts"
  );

  const cron = fs.readFileSync(require.resolve("../app/api/cron/refresh-news/route.ts"), "utf8");
  assert.ok(cron.includes('const TIME_ZONE = "Europe/Stockholm"'));
  assert.match(cron, /if \(localClock\.hour !== 6\)/,
    "Hobby cron may start at any minute within the matching Stockholm hour");
  assert.match(cron, /if \(await hasFreshMorningEditionForToday\(\)\)/,
    "duplicate invocations skip a valid published edition regardless of minute");
  assert.match(cron, /const cronSecret = process\.env\.CRON_SECRET/);
  assert.doesNotMatch(cron, /vercel-cron\/1\.0/,
    "a spoofable User-Agent must not authorize production cron work");
  assert.match(cron, /getArticleRefreshStatus\(stockholmDateKey\(now\)\)/,
    "the retry only repeats editorial work when the previous feed health check failed");
  assert.match(cron, /const edition = await generateMorningEdition\(profile\)/);

  const actions = fs.readFileSync(require.resolve("../app/actions.ts"), "utf8");
  const manualRefresh = actions.slice(
    actions.indexOf("export async function refreshNews()"),
    actions.indexOf("export async function retryMorningEdition()")
  );
  assert.doesNotMatch(manualRefresh, /generateMorningEdition/,
    "refreshing supplemental panels must not regenerate the saved morning edition");
  assert.match(manualRefresh, /morningEditionChanged: false/);
  assert.match(manualRefresh, /Promise\.all\(/);
  const retry = actions.slice(actions.indexOf("export async function retryMorningEdition()"));
  assert.match(retry, /generateMorningEdition\(profile\)/,
    "explicit recovery must be able to generate the missing edition");
  assert.match(retry, /if \(clock\.hour !== 6\)/,
    "manual recovery follows the entire Hobby publication hour");
  assert.doesNotMatch(retry, /clock\.minute >= 40/,
    "manual recovery must not become unavailable after 06:39 when Hobby cron may start later in the hour");

  const edition = fs.readFileSync(require.resolve("../lib/dailyEdition.ts"), "utf8");
  const validateBeforeSave = edition.indexOf("validateDailyEditionForSave(edition, dateKey);", edition.indexOf("export async function generateMorningEdition"));
  const saveEdition = edition.indexOf("const saved = await saveBlobEdition(edition);", validateBeforeSave);
  const failIfNotSaved = edition.indexOf("if (!saved)", saveEdition);
  assert.ok(validateBeforeSave >= 0 && saveEdition > validateBeforeSave && failIfNotSaved > saveEdition,
    "an edition must be validated before being persisted and a failed save must fail the publication");
  assert.match(edition, /validateDailyEditionForSave\(parsed, dateKey\)/,
    "stored editions must be validated on read as well");

  const home = fs.readFileSync(require.resolve("../app/page.tsx"), "utf8");
  assert.match(home, /getTodayDailyEdition\(profile\)/);
  assert.match(home, /Reservedition · inte dagens nyhetsurval/);
  assert.match(home, /Morgoneditionen är inte tillgänglig/);
  assert.match(home, /RetryMorningEditionButton/,
    "the homepage must clearly label fallback/empty states and offer a recovery path");
});


test("daily edition filters invalid article links before final edition validation", () => {
  const edition = fs.readFileSync(require.resolve("../lib/dailyEdition.ts"), "utf8");
  assert.ok(edition.includes("const sectionsWithValidLinks = editorialSections.map(section => ({"));
  assert.ok(edition.includes("stories: section.stories.filter(story => isValidArticleLink(story.link))"));
  assert.ok(edition.includes("allArticles: section.allArticles.filter(story => isValidArticleLink(story.link))"));
  assert.ok(edition.includes("enrichEditorialImages(sectionsWithValidLinks)"));
});

test("football editorial selection follows current relevance rather than fixed league quotas", () => {
  const editor = fs.readFileSync(require.resolve("../lib/editorV2.ts"), "utf8");
  assert.ok(editor.includes("de största och mest omtalade händelserna från de senaste 24 timmarna"));
  assert.ok(editor.includes("footballArticles, profile, 8)"));
  assert.ok(!editor.includes("function classifyFootballLeague"));
  assert.ok(!editor.includes("Reserve a slot for each named league"));
  assert.ok(editor.includes("].slice(0, 10)"));
  assert.ok(editor.includes("högst en tennisartikel"));
});


test("homepage renders all editorial areas in one mixed stream and keeps sport labels", () => {
  const home = fs.readFileSync(require.resolve("../app/page.tsx"), "utf8");
  assert.ok(home.includes("function buildMixedHomepageFeed"));
  assert.ok(home.includes("const mixedStories = buildMixedHomepageFeed(sections, edition.dateKey)"));
  assert.ok(home.includes("section.key === \"elfsborg\" && section.allArticles?.length"));
  assert.ok(home.includes('aria-label="Dagens blandade nyhetsflöde"'));
  assert.ok(home.includes("category={entry.categoryKey}"));
  assert.ok(home.includes('story.sportGroup ?? "Sport"'));
  assert.ok(!home.includes("otherSections.map"));
  assert.ok(!home.includes('section.key === "sport" && index === Math.min'));
});

test("homepage fact panels are separate full-width rows after complete story groups", () => {
  const home = fs.readFileSync(require.resolve("../app/page.tsx"), "utf8");
  const styles = fs.readFileSync(require.resolve("../app/globals.css"), "utf8");
  assert.match(home, /const storyGroups: Array<\{ stories: MixedHomepageStory\[\]; panelIndex\?: number \}> = \[\]/);
  assert.match(home, /storyGroups\.map\(\(group, groupIndex\)/);
  assert.match(home, /group\.stories\.map\(\(entry, localIndex\)/);
  assert.match(home, /group\.panelIndex !== undefined/);
  assert.match(home, /className="mixed-news-interstitial"/);
  assert.match(styles, /\.mixed-news-group\s*\{[\s\S]*?flex-direction: column/);
  assert.match(styles, /\.mixed-news-grid__stories\s*\{[\s\S]*?display: grid/);
  assert.match(styles, /\.mixed-news-interstitial\s*\{[\s\S]*?display: block/);
});

test("tablet homepage keeps overview and article cards in a stable two-column flow", () => {
  const home = fs.readFileSync(require.resolve("../app/page.tsx"), "utf8");
  const styles = fs.readFileSync(require.resolve("../app/globals.css"), "utf8");
  const tabletStart = styles.lastIndexOf("@media (min-width: 640px) and (max-width: 1100px)");
  const mobileStart = styles.indexOf("@media (max-width: 639px)", tabletStart);
  const tabletBlock = styles.slice(tabletStart, mobileStart > tabletStart ? mobileStart : undefined);

  assert.ok(home.includes('className="editorial-overview__title mt-3'));
  assert.ok(!styles.includes("main .grid {\n    grid-template-columns: minmax(0, 1fr) !important;"));
  assert.ok(tabletBlock.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"));
  assert.ok(tabletBlock.includes("grid-template-columns: repeat(2, minmax(0, 1fr))"));
  assert.ok(tabletBlock.includes(".mixed-news-card--lead,\n  .mixed-news-card--wide"));
  assert.ok(tabletBlock.includes("grid-column: span 1;"));
  assert.ok(tabletBlock.includes("flex-direction: column;"));
  assert.ok(tabletBlock.includes("aspect-ratio: 16 / 9;"));
});

test("homepage overview uses three concise lead-story AI takeaways", () => {
  const home = fs.readFileSync(require.resolve("../app/page.tsx"), "utf8");
  assert.ok(home.includes("function buildOverviewHighlights"));
  assert.ok(home.includes("lead?.aiSummary || section.summary"));
  assert.ok(home.includes("words.length > 24"));
  assert.ok(home.includes(".slice(0, 3)"));
  assert.ok(home.includes("Redaktionens tre viktigaste punkter"));
});


test("editorial feed no longer includes Moviezine", () => {
  const rss = fs.readFileSync(require.resolve("../lib/rss.ts"), "utf8");
  const editor = fs.readFileSync(require.resolve("../lib/editorV2.ts"), "utf8");
  assert.doesNotMatch(rss, /moviezine/i);
  assert.doesNotMatch(editor, /moviezine/i);
});

test("daily edition retention is scoped only to dated edition files for the current calendar week", () => {
  const edition = fs.readFileSync(require.resolve("../lib/dailyEdition.ts"), "utf8");
  assert.match(edition, /function pruneOldDailyEditions/);
  assert.ok(edition.includes("const match = blob.pathname.match"));
  assert.ok(edition.includes("const keepFrom = getCalendarWeekStartKey(referenceDateKey)"));
  assert.ok(edition.includes("await del(blob.pathname)"));
  assert.match(edition, /getCalendarWeekStartKey/);
  assert.match(edition, /getCalendarWeekEndKey/);
  assert.match(edition, /await pruneOldDailyEditions\(edition\.dateKey\)/);
});
