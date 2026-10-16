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

test("diagnostic log storage is private, bounded and redacts common secrets", () => {
  const logger = read("lib/diagnosticLog.ts");

  assert.ok(logger.includes('access: "private"'));
  assert.ok(logger.includes("BLOB_READ_WRITE_TOKEN"));
  assert.ok(logger.includes("Bearer\\s+"));
  assert.ok(logger.includes("REDACTED"));
  assert.ok(logger.includes("MAX_RETURNED_LOGS = 80"));
  assert.ok(logger.includes("SAFE_CONTEXT_KEYS"));
  assert.ok(logger.includes("DEDUPE_WINDOW_MS"));
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
