const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const ROOT = path.resolve(__dirname, "..");
require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, moduleResolution: ts.ModuleResolutionKind.Node10, esModuleInterop: true },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};
function loadTs(file, mocks = {}) {
  const absolute = path.join(ROOT, file);
  delete require.cache[absolute];
  const originalLoad = Module._load;
  Module._load = function(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try { return require(absolute); } finally { Module._load = originalLoad; }
}
function validEvent(index = 0, overrides = {}) {
  const stamp = Date.now() + index;
  return {
    eventId: String(stamp) + "-" + String(index + 1).padStart(32, "a"),
    timestamp: new Date(stamp).toISOString(), category: "elfsborg", articleType: "analys",
    source: "Borås Tidning", topic: "Elfsborg", title: "Artikel " + String(index + 1),
    summary: "Sammanfattning som inte behöver skickas till batchlagringen.",
    link: "https://example.test/article/" + String(index + 1), ...overrides,
  };
}
function validBatchId() { return String(Date.now()) + "-" + "b".repeat(32); }
function memoryQueue(initial) {
  let current = structuredClone(initial);
  return {
    read: () => structuredClone(current),
    write: value => { current = structuredClone(value); },
    get current() { return structuredClone(current); },
  };
}
test("reader queue normalizes long metadata before storing clicks locally", () => {
  const values = new Map();
  const dispatched = [];
  global.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  global.window = { dispatchEvent: event => dispatched.push(event.type) };
  try {
    const queue = loadTs("app/components/readerQueue.ts");
    queue.enqueueReaderEvent(validEvent(1, {
      category: "  " + "lokalt ".repeat(30), articleType: "  " + "analys ".repeat(30),
      source: "  " + "källa ".repeat(40), topic: "  " + "Borås-evenemang ".repeat(30),
      title: "  " + "En ovanligt lång rubrik ".repeat(30), summary: "  " + "sammanfattning ".repeat(150),
    }));
    const stored = JSON.parse(values.get(queue.READER_QUEUE_KEY));
    assert.equal(stored.events.length, 1);
    const event = stored.events[0];
    assert.ok(event.category.length <= 80);
    assert.ok(event.articleType.length <= 100);
    assert.ok(event.source.length <= 160);
    assert.ok(event.topic.length <= 160);
    assert.ok(event.title.length <= 300);
    assert.ok(event.summary.length <= 1500);
    assert.equal(event.title.startsWith(" "), false);
    assert.deepEqual(dispatched, [queue.READER_QUEUE_EVENT]);
  } finally { delete global.sessionStorage; delete global.window; }
});
test("one 36-article batch saves once and keeps events added while the request is in flight", async () => {
  const initial = { events: Array.from({ length: 36 }, (_, index) => validEvent(index)) };
  const queue = memoryQueue(initial);
  let requestBody;
  const addedDuringRequest = validEvent(100);
  const result = await loadTs("app/components/readerBatchClient.ts").saveReaderBatch({
    queue: initial, readQueue: queue.read, writeQueue: queue.write, createBatchId: validBatchId,
    fetcher: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      queue.write({ ...queue.current, events: [...queue.current.events, addedDuringRequest] });
      return Response.json({ ok: true, saved: 36, queuedForNightlyProcessing: true });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.saved, 36);
  assert.equal(result.remaining, 1);
  assert.equal(requestBody.events.length, 36);
  assert.equal(requestBody.events[0].summary, undefined);
  assert.equal(queue.current.events.length, 1);
  assert.equal(queue.current.events[0].eventId, addedDuringRequest.eventId);
  assert.equal(queue.current.batchId, undefined);
});
test("failed batch keeps all events and retries with the same idempotent batch ID", async () => {
  const initial = { events: Array.from({ length: 36 }, (_, index) => validEvent(index)) };
  const queue = memoryQueue(initial);
  const batchIds = [];
  const client = loadTs("app/components/readerBatchClient.ts");
  const first = await client.saveReaderBatch({
    queue: initial, readQueue: queue.read, writeQueue: queue.write, createBatchId: validBatchId,
    fetcher: async (_url, init) => {
      batchIds.push(JSON.parse(init.body).batchId);
      return Response.json({ ok: false, error: {
        code: "invalid_event", message: "Minst en artikel innehåller ogiltiga uppgifter.",
        eventIndex: 6, field: "title", fieldLabel: "rubrik",
      } }, { status: 400 });
    },
  });
  assert.equal(first.ok, false);
  assert.match(first.message, /artikel 7/i);
  assert.match(first.message, /rubrik/);
  assert.equal(queue.current.events.length, 36);
  assert.equal(queue.current.batchId, batchIds[0]);
  const second = await client.saveReaderBatch({
    queue: queue.current, readQueue: queue.read, writeQueue: queue.write,
    createBatchId: () => { throw new Error("retry must reuse the previous batch id"); },
    fetcher: async (_url, init) => {
      batchIds.push(JSON.parse(init.body).batchId);
      return Response.json({ ok: true, saved: 36, queuedForNightlyProcessing: true });
    },
  });
  assert.equal(second.ok, true);
  assert.equal(second.saved, 36);
  assert.equal(queue.current.events.length, 0);
  assert.equal(batchIds[0], batchIds[1]);
});
test("sessionStorage failure stops before network and leaves the in-memory queue untouched", async () => {
  const initial = { events: [validEvent()] };
  let fetchCalls = 0;
  const result = await loadTs("app/components/readerBatchClient.ts").saveReaderBatch({
    queue: initial, readQueue: () => initial, writeQueue: () => { throw new Error("storage quota"); },
    createBatchId: validBatchId,
    fetcher: async () => { fetchCalls += 1; return Response.json({ ok: true, saved: 1 }); },
  });
  assert.equal(result.ok, false);
  assert.equal(fetchCalls, 0);
  assert.match(result.message, /kunde inte bevara din kö/i);
  assert.equal(initial.events.length, 1);
});
test("batch API normalizes long metadata, writes one private object and reuses the same path on retry", async () => {
  const objects = new Map();
  const writes = [];
  const blob = {
    put: async (pathname, value, options) => {
      writes.push({ pathname, options }); objects.set(pathname, String(value));
      return { url: "https://example.test/blob" };
    },
    get: async () => null, list: async () => ({ blobs: [] }),
  };
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const previousError = console.error;
  console.error = () => {};
  try {
    const profile = loadTs("lib/readerProfile.ts", {
      "@vercel/blob": blob, "./diagnosticLog": { recordDiagnostic: async () => true },
    });
    const route = loadTs("app/api/events/batch/route.ts", {
      "next/server": { NextResponse: { json: (...args) => Response.json(...args) } },
      "@/lib/readerProfile": profile,
    });
    const batchId = validBatchId();
    const events = Array.from({ length: 36 }, (_, index) => validEvent(index, {
      topic: "topic ".repeat(80), title: "rubrik ".repeat(80), summary: "sammanfattning ".repeat(200),
    }));
    const request = () => new Request("https://glenn-news.vercel.app/api/events/batch", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ batchId, events }),
    });
    const first = await route.POST(request());
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.equal(firstBody.saved, 36);
    assert.equal(writes.length, 1);
    assert.equal(objects.size, 1);
    assert.match(writes[0].pathname, /glenn-news\/profile\/batches\//);
    assert.equal(writes[0].pathname.endsWith(batchId + ".json"), true);
    assert.deepEqual(writes[0].options, {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
    });
    const stored = JSON.parse(objects.get(writes[0].pathname));
    assert.equal(stored.events.length, 36);
    assert.equal(stored.events[0].topic.length, 160);
    assert.equal(stored.events[0].title.length, 300);
    assert.ok(stored.events[0].summary.length <= 1500);
    assert.equal(stored.events[0].summary.trim(), stored.events[0].summary);
    const retry = await route.POST(request());
    const retryBody = await retry.json();
    assert.equal(retry.status, 200);
    assert.equal(retryBody.saved, 36);
    assert.equal(writes.length, 2);
    assert.equal(objects.size, 1);
  } finally {
    console.error = previousError;
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  }
});
test("batch API reports the offending item and field without writing an invalid batch", async () => {
  const writes = [];
  const route = loadTs("app/api/events/batch/route.ts", {
    "next/server": { NextResponse: { json: (...args) => Response.json(...args) } },
    "@/lib/readerProfile": { recordReaderBatch: async (...args) => { writes.push(args); return true; } },
  });
  const events = Array.from({ length: 10 }, (_, index) => validEvent(index));
  events[6] = { ...events[6], link: "javascript:alert(1)" };
  const response = await route.POST(new Request("https://glenn-news.vercel.app/api/events/batch", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ batchId: validBatchId(), events }),
  }));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "invalid_event");
  assert.equal(body.error.eventIndex, 6);
  assert.equal(body.error.field, "link");
  assert.equal(body.error.fieldLabel, "artikellänk");
  assert.equal(writes.length, 0);
});
test("batch API distinguishes a temporary Blob storage failure", async () => {
  const previousToken = process.env.BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  const previousError = console.error;
  console.error = () => {};
  try {
    const profile = loadTs("lib/readerProfile.ts", {
      "@vercel/blob": { put: async () => { throw new Error("temporary Blob error"); } },
      "./diagnosticLog": { recordDiagnostic: async () => true },
    });
    const route = loadTs("app/api/events/batch/route.ts", {
      "next/server": { NextResponse: { json: (...args) => Response.json(...args) } },
      "@/lib/readerProfile": profile,
    });
    const response = await route.POST(new Request("https://glenn-news.vercel.app/api/events/batch", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ batchId: validBatchId(), events: [validEvent()] }),
    }));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, "storage_unavailable");
    assert.match(body.error.message, /ligger kvar i din kö/);
  } finally {
    console.error = previousError;
    if (previousToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = previousToken;
  }
});


test("new clicks rotate an attempted batch ID so nightly idempotency cannot skip them", () => {
  const existing = { events: [validEvent(1)], batchId: validBatchId() };
  const values = new Map([["glenn-news-reading-queue-v1", JSON.stringify(existing)]]);
  global.sessionStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  global.window = { dispatchEvent: () => {} };
  try {
    const queue = loadTs("app/components/readerQueue.ts");
    queue.enqueueReaderEvent(validEvent(2));
    const stored = JSON.parse(values.get(queue.READER_QUEUE_KEY));
    assert.equal(stored.events.length, 2);
    assert.equal(stored.batchId, undefined);
  } finally {
    delete global.sessionStorage;
    delete global.window;
  }
});
