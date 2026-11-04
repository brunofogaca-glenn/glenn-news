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
  assert.ok(panel.includes("Historisk felloggning i Blob är avstängd"));
  assert.ok(panel.includes("Vercel Runtime Logs"));
  assert.ok(panel.includes("Ingen historisk fellogg visas här"));
  assert.doesNotMatch(panel, /Applikationsloggar sparas privat i Blob/);
  assert.doesNotMatch(panel, /Kontrollera att Vercel Blob är konfigurerat med BLOB_READ_WRITE_TOKEN/);
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

test("retired Veckofokus has no active route, navigation or nightly side writes", () => {
  const cron = read("app/api/cron/process-reader-history/route.ts");
  const profile = read("lib/readerProfile.ts");
  const nav = read("app/components/MobileNav.tsx");
  const homepage = read("app/page.tsx");

  assert.equal(fs.existsSync(path.join(root, "app/veckofokus/page.tsx")), false);
  assert.doesNotMatch(nav + homepage, /href="\/veckofokus"/);
  assert.doesNotMatch(cron, /weeklyRead|weeklyFocus|createWeeklyFocus|addWeeklyReadLinks/i);
  assert.doesNotMatch(profile, /weeklyReadLinks|weeklyRead\.ts/);
  assert.ok(profile.includes("const events = [...currentLedger.events]"), "existing history must survive consolidation");
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
