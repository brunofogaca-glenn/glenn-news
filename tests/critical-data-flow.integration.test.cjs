const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

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

function loadBorasCatalog() {
  const filename = path.join(root, "lib/borasEventCatalog.ts");
  delete require.cache[require.resolve(filename)];
  return require(filename);
}

function loadWeeklyRead(blob) {
  const originalLoad = Module._load;
  const filename = path.join(root, "lib/weeklyRead.ts");
  delete require.cache[require.resolve(filename)];
  Module._load = function(request, parent, isMain) {
    if (request === "@vercel/blob") return blob;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(filename);
  } finally {
    Module._load = originalLoad;
  }
}

function event(slug, overrides = {}) {
  return {
    title: "Evenemang " + slug,
    url: "https://www.boras.com/evenemang/" + slug + "/",
    date: "2026-11-20",
    time: "18:00",
    venue: "Borås",
    description: "Ett publikt evenemang",
    missingCompleteScrapes: 0,
    status: "active",
    ...overrides,
  };
}

test("Borås catalog rejects incomplete and undersized scrapes without mutating last-good data", () => {
  const { mergeBorasEventCatalog } = loadBorasCatalog();
  const existing = Array.from({ length: 6 }, (_, i) => event("old-" + i));
  const partial = [event("new-1"), event("new-2")];

  const incomplete = mergeBorasEventCatalog(existing, partial, {
    today: "2026-11-03",
    complete: false,
  });
  const undersized = mergeBorasEventCatalog(existing, partial, {
    today: "2026-11-03",
    complete: true,
    expectedMinimum: 6,
  });

  assert.equal(incomplete.complete, false);
  assert.equal(undersized.complete, false);
  assert.deepEqual(incomplete.events, existing);
  assert.deepEqual(undersized.events, existing);
  assert.equal(incomplete.contentChanged, false);
  assert.equal(undersized.contentChanged, false);
});

test("Borås catalog normalizes tracking variants and keeps one canonical event", () => {
  const { mergeBorasEventCatalog } = loadBorasCatalog();
  const incoming = Array.from({ length: 6 }, (_, i) => event("event-" + i));
  incoming.push(event("event-0", {
    url: "https://boras.com/evenemang/event-0?utm_source=newsletter#details",
    title: "Uppdaterad rubrik",
  }));

  const result = mergeBorasEventCatalog([], incoming, {
    today: "2026-11-03",
    complete: true,
    expectedMinimum: 6,
  });

  assert.equal(result.complete, true);
  assert.equal(result.events.length, 6);
  assert.equal(result.events[0].url, "https://www.boras.com/evenemang/event-0/");
  assert.equal(result.events[0].title, "Uppdaterad rubrik");
});

test("Borås catalog does not remove an event after one or two complete omissions", () => {
  const { mergeBorasEventCatalog } = loadBorasCatalog();
  const existing = [event("kept", { missingCompleteScrapes: 0 })];
  const incoming = Array.from({ length: 6 }, (_, i) => event("other-" + i));

  const once = mergeBorasEventCatalog(existing, incoming, {
    today: "2026-11-03", complete: true, expectedMinimum: 6,
  });
  const twice = mergeBorasEventCatalog(once.events, incoming, {
    today: "2026-11-03", complete: true, expectedMinimum: 6,
  });

  assert.equal(once.events.find(item => item.url.includes("/kept/")).status, "active");
  assert.equal(once.events.find(item => item.url.includes("/kept/")).missingCompleteScrapes, 1);
  assert.equal(twice.events.find(item => item.url.includes("/kept/")).status, "active");
  assert.equal(twice.events.find(item => item.url.includes("/kept/")).missingCompleteScrapes, 2);
});

test("Borås catalog archives an event only after the third complete omission", () => {
  const { mergeBorasEventCatalog } = loadBorasCatalog();
  const existing = [event("kept")];
  const incoming = Array.from({ length: 6 }, (_, i) => event("other-" + i));
  let current = existing;

  for (let count = 0; count < 3; count += 1) {
    current = mergeBorasEventCatalog(current, incoming, {
      today: "2026-11-03", complete: true, expectedMinimum: 6,
    }).events;
  }

  const archived = current.find(item => item.url.includes("/kept/"));
  assert.equal(archived.status, "unlisted");
  assert.equal(archived.missingCompleteScrapes, 3);
});

test("Borås catalog applies explicit cancellation immediately and retains the archived event", () => {
  const { mergeBorasEventCatalog } = loadBorasCatalog();
  const existing = [event("cancel-me")];
  const incoming = Array.from({ length: 6 }, (_, i) => event("other-" + i));
  incoming[0] = event("cancel-me", { status: "cancelled" });

  const result = mergeBorasEventCatalog(existing, incoming, {
    today: "2026-11-03", complete: true, expectedMinimum: 6,
  });
  const cancelled = result.events.find(item => item.url.includes("/cancel-me/"));

  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.missingCompleteScrapes, 0);
});

test("Borås catalog reactivates a returning event and resets its omission counter", () => {
  const { mergeBorasEventCatalog } = loadBorasCatalog();
  const existing = [event("returns", { status: "unlisted", missingCompleteScrapes: 3 })];
  const incoming = [event("returns"), ...Array.from({ length: 5 }, (_, i) => event("other-" + i))];

  const result = mergeBorasEventCatalog(existing, incoming, {
    today: "2026-11-03", complete: true, expectedMinimum: 6,
  });
  const returned = result.events.find(item => item.url.includes("/returns/"));

  assert.equal(returned.status, "active");
  assert.equal(returned.missingCompleteScrapes, 0);
});

test("Borås catalog rejects invalid dates and URLs outside the approved event path", () => {
  const { mergeBorasEventCatalog } = loadBorasCatalog();
  const invalid = [
    event("bad-date", { date: "2026-02-30" }),
    event("external", { url: "https://example.com/evenemang/external/" }),
    event("wrong-path", { url: "https://www.boras.com/nyheter/wrong/" }),
    event("insecure", { url: "http://www.boras.com/evenemang/insecure/" }),
  ];
  const valid = Array.from({ length: 6 }, (_, i) => event("valid-" + i));

  const result = mergeBorasEventCatalog([], [...valid, ...invalid], {
    today: "2026-11-03", complete: true, expectedMinimum: 6,
  });

  assert.equal(result.complete, true);
  assert.equal(result.events.length, 6);
  assert.ok(result.events.every(item => item.url.startsWith("https://www.boras.com/evenemang/")));
});

test("weekly read history creates a new snapshot only when Blob confirms it is missing", async () => {
  const writes = [];
  const blob = {
    get: async () => null,
    put: async (...args) => writes.push(args),
  };
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const { addWeeklyReadLinks } = loadWeeklyRead(blob);

  assert.equal(await addWeeklyReadLinks(["https://example.com/article"]), true);
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0][1]), ["https://example.com/article"]);
});

test("weekly read history merges new links, removes duplicates and preserves the existing order", async () => {
  const writes = [];
  const blob = {
    get: async () => ({
      statusCode: 200,
      stream: new Blob([JSON.stringify([
        "https://example.com/old",
        "https://example.com/already-read",
      ])]).stream(),
    }),
    put: async (...args) => writes.push(args),
  };
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const { addWeeklyReadLinks } = loadWeeklyRead(blob);

  assert.equal(await addWeeklyReadLinks([
    "https://example.com/new",
    "https://example.com/already-read",
  ]), true);
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0][1]), [
    "https://example.com/new",
    "https://example.com/old",
    "https://example.com/already-read",
  ]);
});

test("weekly read history fails closed on transient Blob read errors", async () => {
  let writes = 0;
  const blob = {
    get: async () => { throw new Error("temporary Blob outage"); },
    put: async () => { writes += 1; },
  };
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const { addWeeklyReadLinks } = loadWeeklyRead(blob);

  assert.equal(await addWeeklyReadLinks(["https://example.com/new"]), false);
  assert.equal(writes, 0);
});

test("weekly read history fails closed on malformed JSON and preserves the stored object", async () => {
  let writes = 0;
  const blob = {
    get: async () => ({
      statusCode: 200,
      stream: new Blob(["{not-json"]).stream(),
    }),
    put: async () => { writes += 1; },
  };
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const { addWeeklyReadLinks } = loadWeeklyRead(blob);

  assert.equal(await addWeeklyReadLinks(["https://example.com/new"]), false);
  assert.equal(writes, 0);
});

test("weekly read history does not write when the batch adds no new links", async () => {
  let writes = 0;
  const blob = {
    get: async () => ({
      statusCode: 200,
      stream: new Blob([JSON.stringify(["https://example.com/read"])]).stream(),
    }),
    put: async () => { writes += 1; },
  };
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const { addWeeklyReadLinks } = loadWeeklyRead(blob);

  assert.equal(await addWeeklyReadLinks(["https://example.com/read"]), true);
  assert.equal(writes, 0);
});
