const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");

require.extensions[".ts"] = (module, filename) => {
  const fs = require("node:fs");
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

function loadTs(file, mocks = {}) {
  const absolute = path.join(ROOT, file);
  delete require.cache[absolute];
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(absolute);
  } finally {
    Module._load = originalLoad;
  }
}

async function withFixedTime(iso, action) {
  const NativeDate = global.Date;
  const instant = NativeDate.parse(iso);
  global.Date = class FixedDate extends NativeDate {
    constructor(...args) {
      if (args.length === 0) super(instant);
      else super(...args);
    }
    static now() {
      return instant;
    }
  };
  try {
    return await action();
  } finally {
    global.Date = NativeDate;
  }
}

async function withEnv(name, value, action) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return await action();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

function responseJson(response) {
  return response.json();
}

function blobResult(value) {
  const body = typeof value === "string" ? value : JSON.stringify(value);
  return { stream: new Response(body).body, statusCode: 200 };
}

function responseForRoute(json = {}) {
  return Response.json(json);
}

function emptyNews() {
  return Object.fromEntries([
    "elfsborg", "boras", "sverige", "varlden", "ekonomi",
    "fotboll", "tennis", "sport", "livsstil",
  ].map(key => [key, []]));
}

function createArticleRefreshRoute(options = {}) {
  const saved = [];
  const revalidated = [];
  let articleReads = 0;
  let healthReads = 0;
  const hour = options.hour ?? 8;
  const route = loadTs("app/api/cron/refresh-articles/route.ts", {
    "next/cache": {
      revalidateTag: (...args) => revalidated.push(args),
    },
    "@/lib/githubActionsAuth": {
      authorizeGitHubActionsRefresh: async () => options.authorized !== false,
    },
    "@/lib/diagnosticLog": {
      recordDiagnostic: async () => true,
    },
    "@/lib/articlesCache": {
      getCachedArticles: async () => {
        articleReads += 1;
        if (options.articleReadError) throw new Error("article cache unavailable");
        return { stories: Array.from({ length: options.articleCount ?? 10 }, (_, i) => ({ id: i })) };
      },
    },
    "@/lib/feedHealthCache": {
      getCachedFeedHealth: async () => {
        healthReads += 1;
        return {
          totals: {
            errors: options.errors ?? 0,
            stale: options.stale ?? 0,
            all: options.all ?? 40,
          },
        };
      },
    },
    "@/lib/updateSchedule": {
      canRefreshEditorialSourcesNow: () => hour >= 6,
      getStockholmClock: () => ({ hour, minute: 15 }),
    },
    "@/lib/articleRefreshStatus": {
      getArticleRefreshStatus: async () => options.existingStatus ?? null,
      saveArticleRefreshStatus: async status => {
        saved.push(status);
        return true;
      },
    },
  });
  return {
    GET: route.GET,
    saved,
    revalidated,
    get articleReads() { return articleReads; },
    get healthReads() { return healthReads; },
  };
}

function createSupplementalRoute(options = {}) {
  const calls = {};
  const diagnostics = [];
  const saved = [];
  const loaders = [
    ["weather", "getCachedWeather"],
    ["sport", "getCachedSportDay"],
    ["market", "getCachedMarketDay"],
    ["local", "getCachedLocalSnapshot"],
    ["national", "getCachedNationalSnapshot"],
    ["world", "getCachedWorldSnapshot"],
    ["culture", "getCachedCultureSnapshot"],
    ["header", "getDailyHeaderInfo"],
  ];
  const loaderMocks = {};
  for (const [name, exportName] of loaders) {
    loaderMocks[exportName] = async () => {
      calls[name] = (calls[name] ?? 0) + 1;
      if (options.failSource === name) throw new Error(name + " provider failed");
      return {
        refreshMeta: {
          status: options.staleSource === name ? "stale" : "ok",
          lastSuccessAt: options.lastSuccessAt ?? new Date().toISOString(),
          lastAttemptAt: options.lastAttemptAt ?? new Date().toISOString(),
          persistent: true,
        },
      };
    };
  }
  const route = loadTs("app/api/cron/refresh-data/route.ts", {
    "next/cache": { revalidateTag: () => true },
    "@/lib/githubActionsAuth": {
      authorizeGitHubActionsRefresh: async () => options.authorized !== false,
    },
    "@/lib/diagnosticLog": {
      recordDiagnostic: async entry => { diagnostics.push(entry); return true; },
    },
    "@/lib/weather": { getCachedWeather: loaderMocks.getCachedWeather },
    "@/lib/sportDayCache": { getCachedSportDay: loaderMocks.getCachedSportDay },
    "@/lib/marketDay": { getCachedMarketDay: loaderMocks.getCachedMarketDay },
    "@/lib/dailySnapshots": {
      getCachedCultureSnapshot: loaderMocks.getCachedCultureSnapshot,
      getCachedLocalSnapshot: loaderMocks.getCachedLocalSnapshot,
      getCachedNationalSnapshot: loaderMocks.getCachedNationalSnapshot,
      getCachedWorldSnapshot: loaderMocks.getCachedWorldSnapshot,
    },
    "@/lib/dailyHeader": { getDailyHeaderInfo: loaderMocks.getDailyHeaderInfo },
    "@/lib/updateSchedule": {
      getStockholmClock: () => ({ hour: options.hour ?? 2, minute: 13 }),
    },
    "@/lib/supplementalRefreshRun": {
      getSupplementalRefreshRun: async () => options.previousRun ?? null,
      saveSupplementalRefreshRun: async report => { saved.push(report); return true; },
    },
  });
  return { GET: route.GET, calls, diagnostics, saved };
}

function borasEvent(slug, date, extra = {}) {
  return {
    title: "Evenemang " + slug,
    url: "https://www.boras.com/evenemang/" + slug + "/",
    date,
    ...extra,
  };
}

test("RSS ingestion keeps healthy publishers when one feed returns 503 and removes bad or duplicate stories", async () => {
  await withFixedTime("2026-11-03T08:00:00.000Z", async () => {
    const { FEEDS, getArticles } = loadTs("lib/rss.ts", {
      "./webSources": { getWebArticles: async () => emptyNews() },
      "./updateSchedule": { canRefreshEditorialSourcesNow: () => true },
    });
    const originalFetch = global.fetch;
    const originalError = console.error;
    const freshDate = new Date(Date.now() - 60_000).toUTCString();
    const shared = "https://example.test/story/shared";
    const unique = "https://example.test/story/unique";
    const xml = (title, link, date) =>
      "<rss version=\"2.0\"><channel><title>Test publisher</title>" +
      "<item><title>" + title + "</title><link>" + link.replace(/&/g, "&amp;") +
      "</link><pubDate>" + date + "</pubDate><description>En redaktionell nyhet.</description></item>" +
      "</channel></rss>";
    const fixtures = new Map([
      [FEEDS[1].url, xml("En vardaglig redaktionsnyhet A", shared + "?utm_source=first", freshDate)],
      [FEEDS[2].url, xml("En vardaglig redaktionsnyhet A", shared + "?utm_source=second", freshDate)],
      [FEEDS[3].url, xml("En vardaglig redaktionsnyhet B", unique, freshDate)],
      [FEEDS[4].url, xml("En gammal redaktionsnyhet", "https://example.test/old", "Wed, 01 Jan 2020 00:00:00 GMT")],
      [FEEDS[5].url, xml("En odaterad redaktionsnyhet", "https://example.test/undated", "inte ett datum")],
    ]);
    global.fetch = async input => {
      const url = String(input);
      if (url === FEEDS[0].url) {
        return new Response("temporary provider failure", { status: 503, statusText: "Service Unavailable" });
      }
      return new Response(fixtures.get(url) ?? "<rss version=\"2.0\"><channel><title>Tom källa</title></channel></rss>");
    };
    console.error = () => {};
    try {
      const result = await getArticles(1);
      const stories = Object.values(result).flat();
      assert.equal(stories.length, 2, "two valid unique articles should survive the failed, duplicate, old and invalid-date feeds");
      assert.deepEqual(new Set(stories.map(story => story.link)), new Set([shared + "?utm_source=first", unique]));
    } finally {
      global.fetch = originalFetch;
      console.error = originalError;
    }
  });
});

test("feed-health aggregation reports a failed publisher without rejecting healthy source checks", async () => {
  await withFixedTime("2026-11-03T08:00:00.000Z", async () => {
    const diagnostics = [];
    const { getFeedHealth } = loadTs("lib/feedHealth.ts", {
      "./rss": {
        FEEDS: [
          { url: "https://good.example/feed", category: "sverige" },
          { url: "https://bad.example/feed", category: "elfsborg" },
        ],
        parseFeed: async url => {
          if (url.includes("bad.example")) throw new Error("503 Service Unavailable");
          return { title: "Good publisher", items: [{ pubDate: new Date().toISOString() }] };
        },
      },
      "./webSources": { WEB_SOURCES: [], fetchWebSource: async () => [] },
      "./updateSchedule": { canRefreshEditorialSourcesNow: () => true },
      "./diagnosticLog": { recordDiagnostic: async entry => { diagnostics.push(entry); } },
    });
    const health = await getFeedHealth();
    assert.equal(health.totals.all, 2);
    assert.equal(health.totals.healthy, 1);
    assert.equal(health.totals.errors, 1);
    assert.equal(health.feeds.find(feed => feed.url.includes("good.example")).status, "ok");
    assert.equal(health.feeds.find(feed => feed.url.includes("bad.example")).status, "error");
    assert.equal(diagnostics.length, 1);
  });
});

test("article refresh does not read or invalidate sources before 06:00 Stockholm time", async () => {
  await withFixedTime("2026-11-03T04:15:00.000Z", async () => {
    const route = createArticleRefreshRoute({ hour: 5 });
    const response = await route.GET(new Request("https://glenn-news.vercel.app/api/cron/refresh-articles"));
    const body = await responseJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.refreshed, false);
    assert.equal(body.articleSourcesTouched, false);
    assert.equal(route.articleReads, 0);
    assert.equal(route.healthReads, 0);
    assert.equal(route.revalidated.length, 0);
    assert.equal(route.saved.length, 0);
  });
});

test("article refresh succeeds below the aggregate error threshold and requests retry at the threshold", async () => {
  await withFixedTime("2026-11-03T08:15:00.000Z", async () => {
    const healthy = createArticleRefreshRoute({ hour: 8, articleCount: 12, errors: 9, all: 40, stale: 2 });
    const healthyResponse = await healthy.GET(new Request("https://glenn-news.vercel.app/api/cron/refresh-articles"));
    const healthyBody = await responseJson(healthyResponse);
    assert.equal(healthyResponse.status, 200);
    assert.equal(healthyBody.status.status, "ok");
    assert.equal(healthyBody.status.articleCount, 12);
    assert.equal(healthyBody.status.feedErrors, 9);
    assert.equal(healthyBody.status.staleFeeds, 2);

    const unhealthy = createArticleRefreshRoute({ hour: 8, articleCount: 12, errors: 10, all: 40 });
    const unhealthyResponse = await unhealthy.GET(new Request("https://glenn-news.vercel.app/api/cron/refresh-articles"));
    const unhealthyBody = await responseJson(unhealthyResponse);
    assert.equal(unhealthyResponse.status, 503);
    assert.equal(unhealthyBody.status.status, "retry");
    assert.match(unhealthyBody.status.message, /10 av 40/);
  });
});

test("supplemental refresh isolates one failing source and still records all other source results", async () => {
  await withFixedTime("2026-11-03T01:13:00.000Z", async () => {
    const route = createSupplementalRoute({
      hour: 2,
      failSource: "weather",
      lastSuccessAt: "2026-10-25T00:00:00.000Z",
      lastAttemptAt: "2026-10-25T00:00:00.000Z",
    });
    const response = await route.GET(new Request("https://glenn-news.vercel.app/api/cron/refresh-data"));
    const body = await responseJson(response);
    assert.equal(response.status, 503, "the aggregate run is failed when one required source fails");
    assert.equal(body.failures, 1);
    assert.equal(body.sources.length, 8);
    assert.equal(body.sources.find(source => source.name === "väder").status, "failed");
    assert.equal(body.refreshedSources, 8);
    assert.equal(body.sources.filter(source => source.status === "ok").length, 7);
    assert.equal(route.calls.weather, 1, "the failed probe is isolated and reported without aborting the run");
    for (const name of ["sport", "market", "local", "national", "world", "culture", "header"]) {
      assert.equal(route.calls[name], 2, name + " must still be refreshed after its cache probe");
    }
    assert.equal(route.diagnostics.length, 1);
    assert.equal(route.saved.length, 1);
    assert.equal(body.articleFeedsTouched, false);
  });
});

test("supplemental refresh avoids work outside its window and skips a second successful run for the same Stockholm day", async () => {
  await withFixedTime("2026-11-03T01:13:00.000Z", async () => {
    const completedAt = new Date().toISOString();
    const completed = createSupplementalRoute({
      hour: 2,
      previousRun: { ok: true, checkedAt: completedAt },
    });
    const skippedResponse = await completed.GET(new Request("https://glenn-news.vercel.app/api/cron/refresh-data"));
    const skippedBody = await responseJson(skippedResponse);
    assert.equal(skippedResponse.status, 200);
    assert.equal(skippedBody.skipped, true);
    assert.equal(Object.values(completed.calls).length, 0);
    assert.equal(completed.saved.length, 0);

    const late = createSupplementalRoute({ hour: 6 });
    const lateResponse = await late.GET(new Request("https://glenn-news.vercel.app/api/cron/refresh-data"));
    const lateBody = await responseJson(lateResponse);
    assert.equal(lateResponse.status, 503);
    assert.equal(lateBody.skipped, true);
    assert.equal(Object.values(late.calls).length, 0);
    assert.equal(late.saved.length, 0);
  });
});

test("Borås ingestion refuses to replace a valid catalogue with an incomplete or undersized scrape", async () => {
  await withEnv("BLOB_READ_WRITE_TOKEN", "test-token", async () => {
    const pathname = "glenn-news/boras-events/browser-scrape.json";
    const today = new Date().toISOString().slice(0, 10);
    const futureDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const previousEvents = Array.from({ length: 6 }, (_, i) =>
      borasEvent("existing-" + i, futureDate)
    );
    const initial = {
      version: 2,
      savedAt: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      contentUpdatedAt: new Date().toISOString(),
      sourceUrl: "https://www.boras.com/evenemang/",
      events: previousEvents,
    };
    const store = new Map([[pathname, JSON.stringify(initial)]]);
    const writes = [];
    const blob = loadTs("lib/borasEventStore.ts", {
      "@vercel/blob": {
        get: async key => store.has(key) ? blobResult(store.get(key)) : null,
        put: async (key, value) => { writes.push(key); store.set(key, String(value)); },
      },
    });
    await assert.rejects(
      blob.saveBrowserScrapedBorasEvents(previousEvents.slice(0, 5), { complete: true, expectedMinimum: 6 }),
      /Too few validated events/
    );
    assert.equal(writes.length, 0);
    assert.deepEqual(JSON.parse(store.get(pathname)).events, previousEvents);
    assert.ok(today.length === 10);
  });
});

test("Borås event snapshots normalize URL variants and distinguish unchanged content from an explicit cancellation", async () => {
  await withEnv("BLOB_READ_WRITE_TOKEN", "test-token", async () => {
    const pathname = "glenn-news/boras-events/browser-scrape.json";
    const futureDate = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const currentEvents = Array.from({ length: 6 }, (_, i) =>
      borasEvent("existing-" + i, futureDate)
    );
    const now = new Date().toISOString();
    const store = new Map([[pathname, JSON.stringify({
      version: 2,
      savedAt: now,
      checkedAt: now,
      contentUpdatedAt: now,
      sourceUrl: "https://www.boras.com/evenemang/",
      events: currentEvents,
    })]]);
    let writes = 0;
    const blob = loadTs("lib/borasEventStore.ts", {
      "@vercel/blob": {
        get: async key => store.has(key) ? blobResult(store.get(key)) : null,
        put: async (key, value) => { writes += 1; store.set(key, String(value)); },
      },
    });
    const unchanged = await blob.saveBrowserScrapedBorasEvents(
      currentEvents.map(event => ({ ...event, url: event.url + "?utm_source=night" })),
      { complete: true, expectedMinimum: 6 }
    );
    assert.equal(unchanged.contentChanged, false);
    assert.equal(unchanged.events.length, 6);

    const cancelled = currentEvents.map((event, index) =>
      index === 0 ? { ...event, status: "cancelled" } : event
    );
    const changed = await blob.saveBrowserScrapedBorasEvents(cancelled, { complete: true, expectedMinimum: 6 });
    assert.equal(changed.contentChanged, true);
    assert.equal(changed.events[0].status, "cancelled");
    assert.equal(writes, 2);
  });
});

test("Borås catalogue only unlists an absent event after three complete scrapes and restores it when it returns", () => {
  const { mergeBorasEventCatalog, addCalendarDays } = loadTs("lib/borasEventCatalog.ts");
  const today = new Date().toISOString().slice(0, 10);
  const all = Array.from({ length: 8 }, (_, i) =>
    borasEvent("event-" + i, addCalendarDays(today, 30 + i), i === 7 ? { status: "cancelled" } : {})
  );
  const partialListing = all.slice(0, 6);
  const first = mergeBorasEventCatalog(all, partialListing, { today, complete: true });
  const second = mergeBorasEventCatalog(first.events, partialListing, { today, complete: true });
  const third = mergeBorasEventCatalog(second.events, partialListing, { today, complete: true });
  const missing = third.events.find(event => event.url.endsWith("/event-6/"));
  const cancelled = third.events.find(event => event.url.endsWith("/event-7/"));
  assert.equal(missing.status, "unlisted");
  assert.equal(missing.missingCompleteScrapes, 3);
  assert.equal(cancelled.status, "cancelled");

  const restored = mergeBorasEventCatalog(third.events, all, { today, complete: true });
  const returned = restored.events.find(event => event.url.endsWith("/event-6/"));
  assert.equal(returned.status, "active");
  assert.equal(returned.missingCompleteScrapes, 0);
});

test("reader batch API accepts a valid bounded session and rejects an unsafe link before persistence", async () => {
  const saved = [];
  const { POST } = loadTs("app/api/events/batch/route.ts", {
    "next/server": { NextResponse: { json: (...args) => Response.json(...args) } },
    "@/lib/readerProfile": {
      recordReaderBatch: async (batchId, events) => {
        saved.push({ batchId, events });
        return true;
      },
    },
  });
  const stamp = Date.now();
  const batchId = String(stamp) + "-" + "a".repeat(32);
  const event = {
    eventId: String(stamp) + "-" + "b".repeat(32),
    timestamp: new Date(stamp).toISOString(),
    category: "elfsborg",
    articleType: "analys",
    source: "Borås Tidning",
    title: "Elfsborgs senaste match",
    link: "https://example.test/elfsborg/match",
  };
  const invalid = await POST(new Request("https://glenn-news.vercel.app/api/events/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ batchId, events: [{ ...event, link: "javascript:alert(1)" }] }),
  }));
  assert.equal(invalid.status, 400);
  assert.equal(saved.length, 0);

  const accepted = await POST(new Request("https://glenn-news.vercel.app/api/events/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ batchId, events: [event] }),
  }));
  const acceptedBody = await responseJson(accepted);
  assert.equal(accepted.status, 200);
  assert.equal(acceptedBody.saved, 1);
  assert.equal(acceptedBody.queuedForNightlyProcessing, true);
  assert.equal(saved.length, 1);
});

test("reader batch processing consolidates events into one ledger and is idempotent on the next run", async () => {
  await withEnv("BLOB_READ_WRITE_TOKEN", "test-token", async () => {
    await withFixedTime("2026-11-03T08:00:00.000Z", async () => {
      const batchPath = "glenn-news/profile/batches/" + String(Date.now()) + "-" + "c".repeat(32) + ".json";
      const event = {
        eventId: String(Date.now()) + "-" + "d".repeat(32),
        timestamp: new Date().toISOString(),
        category: "weekfocus",
        articleType: "analys",
        source: "Borås Tidning",
        title: "Veckans fördjupning",
        link: "https://example.test/weekfocus/story",
      };
      const store = new Map([[batchPath, JSON.stringify({ version: 1, events: [event] })]]);
      const writes = [];
      const blob = {
        get: async key => store.has(key) ? blobResult(store.get(key)) : null,
        list: async ({ prefix }) => ({
          blobs: [...store.keys()].filter(key => key.startsWith(prefix)).map(pathname => ({ pathname })),
        }),
        put: async (key, value) => {
          writes.push(key);
          store.set(key, String(value));
        },
      };
      const profile = loadTs("lib/readerProfile.ts", {
        "@vercel/blob": blob,
        "./diagnosticLog": { recordDiagnostic: async () => true },
      });
      const first = await profile.processPendingReaderBatches();
      assert.equal(first.ledgerAvailable, true);
      assert.equal(first.ledgerChanged, true);
      assert.equal(first.updatedBatches, 1);
      assert.equal(first.ledgerEvents.length, 1);
      assert.deepEqual(first.weeklyReadLinks, [event.link]);
      assert.equal(writes.length, 1);

      const second = await profile.processPendingReaderBatches();
      assert.equal(second.ledgerAvailable, true);
      assert.equal(second.ledgerChanged, false);
      assert.equal(second.ledgerEvents.length, 1);
      assert.equal(writes.length, 1, "an already processed batch must not cause another Blob write");
    });
  });
});

test("reader batch processing fails closed when its existing ledger cannot be read", async () => {
  await withEnv("BLOB_READ_WRITE_TOKEN", "test-token", async () => {
    let lists = 0;
    let writes = 0;
    const profile = loadTs("lib/readerProfile.ts", {
      "@vercel/blob": {
        get: async () => ({ stream: null, statusCode: 503 }),
        list: async () => { lists += 1; return { blobs: [] }; },
        put: async () => { writes += 1; },
      },
      "./diagnosticLog": { recordDiagnostic: async () => true },
    });
    const result = await profile.processPendingReaderBatches();
    assert.equal(result.storageAvailable, true);
    assert.equal(result.ledgerAvailable, false);
    assert.equal(lists, 0);
    assert.equal(writes, 0);
  });
});

test("weekly read persistence refuses to overwrite history after a transient read failure and retries idempotently", async () => {
  await withEnv("BLOB_READ_WRITE_TOKEN", "test-token", async () => {
    const pathname = "glenn-news/profile/weekly-read.json";
    let failRead = true;
    let stored = null;
    let writes = 0;
    const weekly = loadTs("lib/weeklyRead.ts", {
      "@vercel/blob": {
        get: async () => {
          if (failRead) throw new Error("Blob temporarily unavailable");
          return stored ? blobResult(stored) : null;
        },
        put: async (key, value) => {
          writes += 1;
          assert.equal(key, pathname);
          stored = String(value);
        },
      },
    });
    const link = "https://example.test/weekfocus/one";
    assert.equal(await weekly.addWeeklyReadLinks([link]), false);
    assert.equal(writes, 0);
    failRead = false;
    assert.equal(await weekly.addWeeklyReadLinks([link]), true);
    assert.deepEqual(JSON.parse(stored), [link]);
    assert.equal(await weekly.addWeeklyReadLinks([link]), true);
    assert.equal(writes, 1);
  });
});

function readerMaintenanceMocks(options = {}) {
  const calls = { weekly: 0, snapshot: 0, rebuild: 0, focus: 0 };
  const { GET } = loadTs("app/api/cron/process-reader-history/route.ts", {
    "next/server": { NextResponse: { json: (...args) => Response.json(...args) } },
    "@/lib/githubActionsAuth": { authorizeGitHubActionsRefresh: async () => true },
    "@/lib/readerProfile": {
      processPendingReaderBatches: async () => options.processed ?? {
        storageAvailable: true,
        ledgerAvailable: true,
        ledgerChanged: false,
        ledgerUpdatedAt: "ledger-1",
        ledgerEvents: [],
        scannedBatches: 1,
        updatedBatches: 0,
        classifiedEvents: 0,
        classificationFailures: 0,
        pendingEvents: 0,
        weeklyReadLinks: [],
      },
      getReaderProfileSnapshotForMaintenance: async () => {
        calls.snapshot += 1;
        return options.currentSnapshot ?? null;
      },
      rebuildAndSaveReaderProfileSnapshot: async () => {
        calls.rebuild += 1;
        return options.rebuiltSnapshot ?? { saved: true, generatedAt: new Date().toISOString(), profile: {} };
      },
    },
    "@/lib/weeklyRead": {
      addWeeklyReadLinks: async () => {
        calls.weekly += 1;
        return options.weeklySaved !== false;
      },
    },
    "@/lib/weekFocus": {
      createWeeklyFocus: async () => {
        calls.focus += 1;
        if (options.focusFails) throw new Error("Week Focus generation failed");
        return { stories: [] };
      },
    },
    "@/lib/updateSchedule": { getStockholmClock: () => ({ hour: 2, minute: 15 }) },
  });
  return { GET, calls };
}

test("nightly reader maintenance does not update the profile when weekly read state cannot be saved", async () => {
  await withFixedTime("2026-11-03T01:15:00.000Z", async () => {
    const processed = {
      storageAvailable: true,
      ledgerAvailable: true,
      ledgerChanged: true,
      ledgerUpdatedAt: "ledger-2",
      ledgerEvents: [],
      scannedBatches: 1,
      updatedBatches: 1,
      classifiedEvents: 0,
      classificationFailures: 0,
      pendingEvents: 0,
      weeklyReadLinks: ["https://example.test/weekfocus/read"],
    };
    const route = readerMaintenanceMocks({ processed, weeklySaved: false });
    const response = await route.GET(new Request("https://glenn-news.vercel.app/api/cron/process-reader-history"));
    const body = await responseJson(response);
    assert.equal(response.status, 503);
    assert.equal(body.snapshotUpdated, false);
    assert.equal(route.calls.weekly, 1);
    assert.equal(route.calls.snapshot, 0);
    assert.equal(route.calls.rebuild, 0);
  });
});

test("nightly reader maintenance skips an unchanged profile snapshot instead of writing it again", async () => {
  await withFixedTime("2026-11-03T01:15:00.000Z", async () => {
    const route = readerMaintenanceMocks({
      currentSnapshot: {
        sourceLedgerUpdatedAt: "ledger-1",
        generatedAt: "2026-11-03T01:00:00.000Z",
        profile: { totalClicks: 4 },
      },
    });
    const response = await route.GET(new Request("https://glenn-news.vercel.app/api/cron/process-reader-history"));
    const body = await responseJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.snapshotSkipped, true);
    assert.equal(body.snapshotUpdated, false);
    assert.equal(route.calls.snapshot, 1);
    assert.equal(route.calls.rebuild, 0);
  });
});

test("a failed optional Week Focus precomputation does not fail nightly reader maintenance", async () => {
  await withFixedTime("2026-11-07T01:15:00.000Z", async () => {
    const route = readerMaintenanceMocks({ focusFails: true });
    const response = await route.GET(new Request("https://glenn-news.vercel.app/api/cron/process-reader-history"));
    const body = await responseJson(response);
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.weeklyFocusPrecomputed, false);
    assert.equal(route.calls.rebuild, 1);
    assert.equal(route.calls.focus, 1);
  });
});

test("diagnostics redact secrets, keep only safe context and deduplicate repeated incidents", async () => {
  await withEnv("CRON_SECRET", "very-secret-cron-token-123", async () => {
    const diagnostics = loadTs("lib/diagnosticLog.ts");
    const originalError = console.error;
    const lines = [];
    console.error = (...args) => lines.push(args.join(" "));
    try {
      const entry = {
        level: "error",
        component: "refresh.integration-test",
        message: "Provider failed at https://provider.example/feed?token=should-not-leak",
        error: new Error("Authorization: Bearer super-private-token"),
        context: {
          route: "/api/cron/refresh-data",
          source: "provider.example",
          password: "must-not-be-included",
        },
      };
      assert.equal(await diagnostics.recordDiagnostic(entry), true);
      assert.equal(await diagnostics.recordDiagnostic(entry), false);
      assert.equal(lines.length, 1);
      assert.equal(lines[0].includes("should-not-leak"), false);
      assert.equal(lines[0].includes("super-private-token"), false);
      assert.equal(lines[0].includes("very-secret-cron-token-123"), false);
      assert.equal(lines[0].includes("must-not-be-included"), false);
      assert.equal(lines[0].includes("[REDACTED]"), true);
    } finally {
      console.error = originalError;
    }
  });
});


function validEditorialStory(overrides = {}) {
  return {
    title: "En viktig nyhet",
    link: "https://example.test/story",
    articleType: "nyhet",
    aiSummary: "En kort sammanfattning av nyheten.",
    selectionReason: "Vald för morgonutgåvan.",
    ...overrides,
  };
}

function validPreviousEdition(dateKey, repeatedStory) {
  const definitions = [
    ["elfsborg", "Elfsborg"],
    ["boras", "Lokalt"],
    ["sverige", "Sverige"],
    ["varlden", "Världen"],
    ["ekonomi", "Ekonomi"],
    ["sport", "Sport"],
    ["livsstil", "Kultur, Mat & Livsstil"],
  ];
  return {
    dateKey,
    generatedAt: dateKey + "T06:45:00.000Z",
    totalArticles: 1,
    storage: "blob",
    sections: definitions.map(([key, title]) => ({
      key,
      title,
      summary: "Gårdagens sammanfattning.",
      stories: key === "elfsborg" ? [repeatedStory] : [],
      ...(key === "elfsborg" ? { allArticles: [repeatedStory] } : {}),
    })),
  };
}

test("morning edition generation filters yesterday's story, rejects unsafe links and publishes one complete saved edition", async () => {
  await withEnv("BLOB_READ_WRITE_TOKEN", "test-token", async () => {
    await withFixedTime("2026-11-03T05:40:00.000Z", async () => {
      const repeatedStory = validEditorialStory({
        title: "Elfsborg vann efter sent avgörande",
        link: "https://example.test/elfsborg/sent-avgorande?utm_source=yesterday",
      });
      const previousPath = "glenn-news/editions/2026-11-02.json";
      const previous = validPreviousEdition("2026-11-02", repeatedStory);
      const store = new Map([[previousPath, JSON.stringify(previous)]]);
      const writes = [];
      const news = emptyNews();
      news.elfsborg = [
        {
          title: repeatedStory.title,
          link: "https://example.test/elfsborg/sent-avgorande?utm_source=today",
          articleType: "nyhet",
        },
        {
          title: "Elfsborg analyserar nästa match",
          link: "https://example.test/elfsborg/analysis",
          articleType: "analys",
        },
      ];
      news.sverige = [
        {
          title: "Ogiltig länk ska aldrig publiceras",
          link: "javascript:alert(1)",
          articleType: "nyhet",
        },
        {
          title: "Riksdagen presenterar ett nytt förslag",
          link: "https://example.test/sverige/proposal",
          articleType: "nyhet",
        },
      ];
      news.fotboll = [{
        title: "Premier League summerar helgens matcher",
        link: "https://example.test/fotboll/roundup",
        articleType: "analys",
      }];

      const sections = [
        ["elfsborg", "Elfsborg"],
        ["boras", "Lokalt"],
        ["sverige", "Sverige"],
        ["varlden", "Världen"],
        ["ekonomi", "Ekonomi"],
        ["sport", "Sport"],
        ["livsstil", "Kultur, Mat & Livsstil"],
      ];
      const buildSection = (key, title, articles) => ({
        key,
        title,
        summary: title + " sammanfattning.",
        stories: articles.map((article, index) => validEditorialStory({
          ...article,
          aiSummary: "Sammanfattning " + String(index + 1) + " för " + title + ".",
        })),
        ...(key === "elfsborg" ? {
          allArticles: articles.map(article => validEditorialStory(article)),
        } : {}),
      });

      const editionModule = loadTs("lib/dailyEdition.ts", {
        "@vercel/blob": {
          get: async key => store.has(key) ? blobResult(store.get(key)) : null,
          put: async (key, value) => {
            writes.push({ key, value: String(value) });
            store.set(key, String(value));
          },
          list: async () => ({ blobs: [], hasMore: false }),
          del: async () => {},
        },
        "next/cache": {
          unstable_cache: fn => fn,
        },
        "./diagnosticLog": {
          recordDiagnostic: async () => true,
        },
        "./editorV2": {
          createEditorialSection: async (key, title, articles) => buildSection(key, title, articles),
          createSportEditorialSection: async (football, otherSports) =>
            buildSection("sport", "Sport", [...football, ...otherSports]),
          enrichEditorialImages: async value => value,
        },
        "./articlesCache": {
          getCachedArticles: async () => news,
        },
        "./updateSchedule": {
          canRefreshEditorialSourcesNow: () => true,
        },
      });

      const edition = await editionModule.generateMorningEdition({
        category: {}, articleType: {}, source: {}, topic: {}, totalClicks: 0, lastUpdated: null,
      });

      assert.equal(edition.dateKey, "2026-11-03");
      assert.equal(edition.storage, "blob");
      assert.equal(edition.sections.length, 7);
      assert.deepEqual(edition.sections.map(section => section.key), sections.map(([key]) => key));
      assert.equal(edition.totalArticles, 4, "the source pool count includes the malformed input link, but not yesterday's repeated story");
      assert.equal(
        edition.sections.find(section => section.key === "elfsborg").stories.some(story => story.title === repeatedStory.title),
        false,
        "a URL with a different tracking query must not repeat yesterday's article"
      );
      assert.ok(
        edition.sections.find(section => section.key === "elfsborg").stories.some(story => story.title === "Elfsborg analyserar nästa match")
      );
      const swedenStories = edition.sections.find(section => section.key === "sverige").stories;
      assert.equal(swedenStories.length, 1);
      assert.equal(swedenStories[0].link, "https://example.test/sverige/proposal");
      assert.equal(writes.length, 1, "one valid morning edition is persisted in one Blob write");
      assert.equal(writes[0].key, "glenn-news/editions/2026-11-03.json");
      assert.equal(JSON.parse(writes[0].value).sections.length, 7);
    });
  });
});
