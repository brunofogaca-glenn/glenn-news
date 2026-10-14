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
  assert.equal(ranked.personalizationScore, 0);
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
