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
  assert.ok(panel.includes("Historisk felloggning i Blob 채r avst채ngd"));
  assert.ok(panel.includes("Vercel Runtime Logs"));
  assert.ok(panel.includes("Ingen historisk fellogg visas h채r"));
  assert.doesNotMatch(panel, /Applikationsloggar sparas privat i Blob/);
  assert.doesNotMatch(panel, /Kontrollera att Vercel Blob 채r konfigurerat med BLOB_READ_WRITE_TOKEN/);
  assert.ok(route.includes("Cache-Control"));
  assert.ok(route.includes('endsWith(".vercel.app")'));
});

test("diagnostics use redacted, deduplicated runtime logs without Blob writes", () => {
  const logger = read("lib/diagnosticLog.ts");

  assert.ok(logger.includes("Vercel Runtime Logs"));
  assert.ok(logger.떻쬺�^