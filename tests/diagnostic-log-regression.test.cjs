const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("health page includes a copyable diagnostic log panel", () => {
  const page = read("app/health/page.tsx");
  const panel = read("app/components/HealthLogPanel.tsx");
  const route = read("app/api/health/logs/route.ts");

  assert.ok(page.includes("HealthLogPanel"));
  assert.ok(panel.includes("Kopiera hela felrapporten"));
  assert.ok(panel.includes("navigator.clipboard.writeText"));
  assert.ok(panel.includes("Senaste 24 timmarna"));
  assert.ok(panel.includes("Senaste 7 dagarna"));
  assert.ok(panel.includes("Visa tekniska detaljer"));
  assert.ok(route.includes("Cache-Control"));
  assert.ok(route.includes('endsWith(".vercel.app")'));
});

test("diagnostics use redacted, deduplicated runtime logs without Blob writes", () => {
  const logger = read("lib/diagnosticLog.ts");

  assert.ok(logger.includes("Vercel Runtime Logs"));
  assert.ok(logger.includes("Bearer\\s+"));
  assert.ok(logger.includes("REDACTED"));
  assert.ok(logger.includes("SAFE_CONTEXT_KEYS"));
  assert.ok(logger.includes("DEDUPE_WINDOW_MS"));
  assert.ok(!logger.includes('@vercel/blob'));
  assert.ok(!logger.includes("await put("));
  assert.ok(!logger.includes("await list("));
});

test("Week Focus uses one cached edition for Saturday and Sunday", () => {
  const cache = read("lib/weekFocusCache.ts");
  const focus = read("lib/weekFocus.ts");
  const page = read("app/veckofokus/page.tsx");

  assert.ok(cache.includes('CACHE_PREFIX = "glenn-news/week-focus/cache/"'));
  assert.ok(cache.includes('timeZone: "Europe/Stockholm"'));
  assert.ok(cache.includes("const dateKey = weekendEditionDateKey()"));
  assert.ok(cache.includes("getCachedWeeklyFocus"));
  assert.ok(cache.includes("readPersistentCache(dateKey, isValid)"));
  assert.ok(cache.includes("writePersistentCache(dateKey, fingerprint, value)"));
  assert.ok(cache.includes("inFlight.get(dateKey)"));
  assert.ok(!cache.includes("WEEK_FOCUS_CACHE_TTL_MS"));
  assert.ok(focus.includes("getCachedWeeklyFocus<WeeklyFocus>(isValidWeeklyFocus)"));
  assert.ok(focus.includes("collectWeeklyCandidates(editions, readLinks)"));
  assert.ok(focus.includes("dependencies.loadSavedEditions(7)"));
  assert.ok(page.includes('weekday === "Sat" || weekday === "Sun"'));
  assert.ok(page.includes('<SaveReadingHistoryButton mode="weekfocus" />'));
});

test("reader history is consolidated and clicked articles are not individually classified", () => {
  const profile = read("lib/readerProfile.ts");
  const processor = profile.slice(
    profile.indexOf("export async function processPendingReaderBatches"),
    profile.indexOf("async function getLegacyProfile")
  );

  assert.ok(profile.includes('READER_HISTORY_LEDGER_PATH = "glenn-news/profile/reader-history-ledger.json"'));
  assert.ok(profile.includes("writeReaderHistoryLedger(nextLedger)"));
  assert.ok(profile.includes("getEventProfile(storedHistory)"));
  assert.ok(profile.includes("getSemanticEventProfile(storedHistory)"));
  assert.doesNotMatch(processor, /classifyClickedArticle/);
  assert.doesNotMatch(processor, /put\(blob\.pathname/);
  assert.ok(profile.includes("const ledger = await readReaderHistoryLedger()"));
});

test("critical production error paths record diagnostics", () => {
  for (const file of [
    "lib/feedHealth.ts",
    "lib/dailyEdition.ts",
    "lib/editorV2.ts",
    "lib/readerProfile.ts",
    "app/api/cron/refresh-news/route.ts",
    "app/api/cron/refresh-articles/route.ts",
    "app/api/cron/refresh-data/route.ts",
  ]) {
    assert.ok(read(file).includes("recordDiagnostic"), file + " should record diagnostic errors");
  }
});
