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

  assert.match(page, /HealthLogPanel/);
  assert.match(panel, /Kopiera hela felrapporten/);
  assert.match(panel, /navigator\\.clipboard\\.writeText/);
  assert.match(panel, /Senaste 24 timmarna/);
  assert.match(panel, /Senaste 7 dagarna/);
  assert.match(panel, /Visa tekniska detaljer/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /endsWith\\("\\.vercel\\.app"\\)/);
});

test("diagnostic log storage is private, bounded and redacts common secrets", () => {
  const logger = read("lib/diagnosticLog.ts");

  assert.match(logger, /access: "private"/);
  assert.match(logger, /BLOB_READ_WRITE_TOKEN/);
  assert.match(logger, /Bearer\\s/);
  assert.match(logger, /REDACTED/);
  assert.match(logger, /MAX_RETURNED_LOGS = 80/);
  assert.match(logger, /SAFE_CONTEXT_KEYS/);
  assert.match(logger, /DEDUPE_WINDOW_MS/);
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
    assert.match(read(file), /recordDiagnostic/, file + " should record diagnostic errors");
  }
});
