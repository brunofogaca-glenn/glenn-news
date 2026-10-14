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
const { collectWeeklyCandidates, canonicalizeLink } = require("../lib/weekFocusCandidates.ts");
const { buildWeeklyInterestProfile } = require("../lib/weekFocusInterests.ts");
const { createWeeklyFocusFingerprint, getOrCreateWeeklyFocus } = require("../lib/weekFocusCache.ts");
const { createWeeklyFocus } = require("../lib/weekFocus.ts");
const { curateWeeklyCandidates, scoreWeeklyReadingQuality, isNewswireCandidate } = require("../lib/weekFocusQuality.ts");

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

test("WeekFocus includes full-coverage allArticles candidates and de-duplicates them", () => {
  const selectedStory = {
    title: "Elfsborgs första analys",
    description: "Vald till morgoneditionen",
    source: "Sportredaktionen",
    link: "https://www.example.com/elfsborg?utm_source=morning",
    date: "2026-10-14T05:30:00.000Z",
    articleType: "analys",
    aiSummary: "Redaktionell sammanfattning",
    selectionReason: "Vald text",
    topic: "Elfsborg",
  };
  const fullCoverageStory = {
    title: "En längre oläst Elfsborgsartikel",
    description: "Finns bara i fullständiga artikelpoolen",
    source: "Lokalredaktionen",
    link: "https://example.com/elfsborg-long-read",
    date: "2026-10-13T05:30:00.000Z",
    articleType: "reportage",
  };
  const alreadyReadStory = {
    title: "En artikel som redan är läst",
    source: "Nyhetsbyrån",
    link: "https://example.com/read?utm_campaign=weekfocus",
    articleType: "nyhet",
  };

  const readLinks = new Set([canonicalizeLink(alreadyReadStory.link)]);
  const candidates = collectWeeklyCandidates([{
    dateKey: "2026-10-14",
    generatedAt: "2026-10-14T05:30:00.000Z",
    totalArticles: 3,
    storage: "blob",
    sections: [{
      key: "elfsborg",
      title: "Elfsborg",
      summary: "",
      stories: [selectedStory],
      allArticles: [
        { ...selectedStory, title: "Samma artikel med annan spårningslänk" },
        fullCoverageStory,
        alreadyReadStory,
      ],
    }],
  }], readLinks);

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].title, selectedStory.title);
  assert.equal(candidates[1].title, fullCoverageStory.title);
  assert.equal(candidates[1].category, "elfsborg");
  assert.equal(new Set(candidates.map(item => canonicalizeLink(item.link))).size, 2);
  assert.ok(!candidates.some(item => item.title === alreadyReadStory.title));
});

test("WeekFocus builds explicit interest counts from the actual weekly click history", () => {
  const profile = buildWeeklyInterestProfile([
    { id: 0, title: "Elfsborg analyseras efter segern", category: "sport", articleType: "analys", source: "Borås Tidning", topic: "IF Elfsborg", date: "2026-10-14" },
    { id: 1, title: "Elfsborg behöver förstärka laget", category: "elfsborg", articleType: "krönika", source: "Borås Tidning", topic: "IF Elfsborg", date: "2026-10-13" },
    { id: 2, title: "Manchester United ändrar spelsystem", category: "sport", articleType: "reportage", source: "The Guardian", topic: "Manchester United", date: "2026-10-12" },
    { id: 3, title: "Manchester United söker ny anfallare", category: "sport", articleType: "analys", source: "The Guardian", topic: "Manchester United", date: "2026-10-11" },
  ]);

  assert.equal(profile.uniqueReadCount, 4);
  assert.equal(profile.categories[0].label, "sport");
  assert.equal(profile.categories[0].articleCount, 3);
  assert.equal(profile.articleTypes[0].label, "analys");
  assert.equal(profile.articleTypes[0].articleCount, 2);
  assert.equal(profile.sources[0].label, "Borås Tidning");
  assert.equal(profile.sources[0].articleCount, 2);
  assert.equal(profile.topics.find(item => item.label === "IF Elfsborg").articleCount, 2);
  assert.equal(profile.topics.find(item => item.label === "Manchester United").articleCount, 2);
  assert.equal(profile.topTerms.find(item => item.label === "elfsborg").articleCount, 2);
});

test("WeekFocus prefers deep reads over short syndicated copy and removes near-duplicate titles", () => {
  const wireBrief = {
    id: 0, title: "Elfsborg säljer stjärnan till italiensk klubb",
    description: "Kort notis.", source: "TT Nyhetsbyrån", category: "elfsborg",
    link: "https://example.com/wire-brief", image: null, date: "2026-10-14",
    articleType: "nyhet", aiSummary: "", selectionReason: "",
  };
  const originalAnalysis = {
    id: 1, title: "Elfsborg säljer stjärnan till italiensk klubb – analys",
    description: "En längre genomgång av klubbens strategi, spelarens roll och vad affären innebär för lagbygget. ".repeat(8),
    source: "Offside", category: "elfsborg", link: "https://example.com/original-analysis",
    image: null, date: "2026-10-13", articleType: "analys",
    aiSummary: "Fördjupning med bakgrund och konsekvenser.", selectionReason: "",
  };
  const independentInterview = {
    id: 2, title: "Tränaren berättar om lagets nya spelidé",
    description: "Ett längre samtal om utveckling, taktik och framtiden.",
    source: "Lokalredaktionen", category: "sport", link: "https://example.com/interview",
    image: null, date: "2026-10-12", articleType: "intervju", aiSummary: "", selectionReason: "",
  };

  assert.equal(isNewswireCandidate(wireBrief), true);
  assert.ok(scoreWeeklyReadingQuality(originalAnalysis) > scoreWeeklyReadingQuality(wireBrief));
  const curated = curateWeeklyCandidates([wireBrief, originalAnalysis, independentInterview]);
  assert.equal(curated.length, 2);
  assert.equal(curated[0].link, originalAnalysis.link);
  assert.equal(curated[0].articleType, "analys");
  assert.equal(curated.some(item => item.link === wireBrief.link), false);
});

test("WeekFocus cache fingerprints are stable and change with relevant inputs", () => {
  const first = createWeeklyFocusFingerprint({
    profile: { source: "BT", category: "elfsborg" },
    candidates: [{ link: "https://example.com/one", title: "Rubrik" }],
    history: [1, 2, 3],
  });
  const sameInputDifferentKeyOrder = createWeeklyFocusFingerprint({
    history: [1, 2, 3],
    candidates: [{ title: "Rubrik", link: "https://example.com/one" }],
    profile: { category: "elfsborg", source: "BT" },
  });
  const changedInput = createWeeklyFocusFingerprint({
    history: [1, 2, 3, 4],
    candidates: [{ title: "Rubrik", link: "https://example.com/one" }],
    profile: { category: "elfsborg", source: "BT" },
  });

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, sameInputDifferentKeyOrder);
  assert.notEqual(first, changedInput);
});

test("WeekFocus concurrent requests with the same fingerprint share one generation", async () => {
  const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const fingerprint = createWeeklyFocusFingerprint({ test: "same-flight-2026-10-14" });
  let generationCount = 0;
  const create = async () => {
    generationCount += 1;
    await new Promise(resolve => setTimeout(resolve, 10));
    return { title: "Veckofokus", stories: [] };
  };
  const isValid = value => Boolean(value && typeof value === "object" && value.title === "Veckofokus");

  try {
    const results = await Promise.all([
      getOrCreateWeeklyFocus(fingerprint, create, isValid),
      getOrCreateWeeklyFocus(fingerprint, create, isValid),
      getOrCreateWeeklyFocus(fingerprint, create, isValid),
    ]);
    assert.equal(generationCount, 1);
    assert.deepEqual(results, [
      { title: "Veckofokus", stories: [] },
      { title: "Veckofokus", stories: [] },
      { title: "Veckofokus", stories: [] },
    ]);
  } finally {
    if (originalToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = originalToken;
  }
});

test("WeekFocus end-to-end selects an unread deep read and reuses output until read state changes", async () => {
  const historyFixture = [{ timestamp: "2026-10-13T07:20:00.000Z", title: "Elfsborgs presspel fungerade igen", category: "elfsborg", articleType: "analys", source: "Borås Tidning", topic: "IF Elfsborg", link: "https://example.com/read-history-elfsborg" }];
  const articleA = { title: "Analys: IF Elfsborg pressade högt i ny matchplan", description: "En fördjupad genomgång av presspelet, lagdelarnas avstånd och hur tränaren har förändrat lagets uppbyggnad. ".repeat(7), source: "Offside", link: "https://example.com/elfsborg-analysis", image: null, date: "2026-10-14T05:15:00.000Z", articleType: "analys", aiSummary: "En taktisk fördjupning.", selectionReason: "Taktisk analys.", topic: "IF Elfsborg" };
  const articleB = { title: "Intervju: Så tänker Riksbanken om nästa räntebesked", description: "Ett längre samtal om inflationsutsikter, hushållens ekonomi och hur kommande räntebeslut kan påverka bolånetagare. ".repeat(6), source: "Ekonomikanalen", link: "https://example.com/riksbank-interview", image: null, date: "2026-10-14T05:30:00.000Z", articleType: "intervju", aiSummary: "Bakgrund om ränteläget.", selectionReason: "En intervju med nya perspektiv.", topic: "Riksbanken" };
  const edition = { dateKey: "2026-10-14", generatedAt: "2026-10-14T04:35:00.000Z", totalArticles: 2, storage: "blob", sections: [ { key: "elfsborg", title: "Elfsborg", summary: "Elfsborgsnyheter", stories: [articleA], allArticles: [articleA] }, { key: "ekonomi", title: "Ekonomi", summary: "Ekonominyheter", stories: [articleB] } ] };
  let savedReadLinks = []; let editorCalls = 0; let activityCalls = 0;
  const cache = new Map(); const pending = new Map();
  const isValidFocus = value => Boolean(value && typeof value === "object" && value.title === "Veckofokus" && Array.isArray(value.stories) && value.stories.every(story => typeof story.link === "string"));
  const getOrCreate = async (fingerprint, create, isValid) => {
    if (cache.has(fingerprint) && isValid(cache.get(fingerprint))) return cache.get(fingerprint);
    if (pending.has(fingerprint)) return pending.get(fingerprint);
    const task = (async () => { const result = await create(); if (isValid(result)) cache.set(fingerprint, result); return result; })();
    pending.set(fingerprint, task);
    try { return await task; } finally { if (pending.get(fingerprint) === task) pending.delete(fingerprint); }
  };
  const generateEditorResponse = async input => {
    editorCalls += 1;
    const historyMarker = "READ-HISTORY:";
    const candidatesMarker = "CANDIDATES (olästa texter):";
    const returnMarker = "Returnera ENDAST giltig JSON";
    const historyLabelIndex = input.lastIndexOf(historyMarker);
    const historyStart = historyLabelIndex + historyMarker.length;
    const candidatesStart = input.indexOf(candidatesMarker, historyStart);
    const returnStart = input.indexOf(returnMarker, candidatesStart);
    assert.ok(historyLabelIndex >= 0 && candidatesStart > historyStart && returnStart > candidatesStart);
    const history = JSON.parse(input.slice(historyStart, candidatesStart).trim());
    const candidates = JSON.parse(input.slice(candidatesStart + candidatesMarker.length, returnStart).trim());
    assert.ok(history.length > 0); assert.ok(candidates.length > 0);
    const candidate = candidates[0];
    return { output_text: JSON.stringify({ summary: "Veckans val bygger på faktisk läsning och ger en ny fördjupning.", stories: [{ id: candidate.id, topic: candidate.category === "elfsborg" ? "IF Elfsborg" : "Ekonomi och räntor", readIds: [history[0].id], summary: "Fördjupning vald ur veckans olästa kandidater.", selectionReason: "Vald utifrån läshistoriken och artikelns djup.", articleType: candidate.articleType }] }) };
  };
  const profile = { category: { elfsborg: 2 }, articleType: { analys: 2 }, source: { "Borås Tidning": 1 }, topic: { "IF Elfsborg": 2 }, semanticCategory: {}, semanticArticleType: {}, semanticTopic: {}, semanticTag: {}, entity: {}, geography: {}, eventKey: {}, semanticClicks: 1, totalClicks: 1, lastUpdated: "2026-10-13T07:20:00.000Z" };
  const dependencies = { loadReaderActivity: async () => { activityCalls += 1; return historyFixture; }, loadWeeklyReadLinks: async () => [...savedReadLinks], loadTodayEdition: async () => edition, loadSavedEditions: async () => [edition], generateEditorResponse, getOrCreate };

  const first = await createWeeklyFocus(profile, dependencies);
  assert.equal(first.title, "Veckofokus"); assert.equal(first.stories.length, 1); assert.equal(first.personalized, true); assert.equal(first.stories[0].topicReadCount, 1);
  assert.ok([articleA.link, articleB.link].includes(first.stories[0].link)); assert.equal(editorCalls, 1);
  const repeated = await createWeeklyFocus(profile, dependencies);
  assert.deepEqual(repeated, first, "the same editorial inputs reuse the cached result"); assert.equal(editorCalls, 1, "an unchanged request does not call AI again");
  savedReadLinks = [first.stories[0].link];
  const afterRead = await createWeeklyFocus(profile, dependencies);
  assert.equal(afterRead.stories.length, 1); assert.notEqual(afterRead.stories[0].link, first.stories[0].link, "marking a story read changes the candidate pool");
  assert.equal(editorCalls, 2, "a changed read state generates a fresh editorial result"); assert.equal(activityCalls, 3);
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
