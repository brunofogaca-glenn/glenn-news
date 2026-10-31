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
const { detectCategory } = require("../lib/categorizer.ts");
const { collectWeeklyCandidates, canonicalizeLink } = require("../lib/weekFocusCandidates.ts");
const { buildWeeklyInterestProfile } = require("../lib/weekFocusInterests.ts");
const { isSlowResponse, summarizeResponseTimes, prioritizeHealthFeeds, SLOW_RESPONSE_THRESHOLD_MS } = require("../lib/feedHealthMetrics.ts");
const { createWeeklyFocusFingerprint, getOrCreateWeeklyFocus } = require("../lib/weekFocusCache.ts");
const { createWeeklyFocus } = require("../lib/weekFocus.ts");
const { curateWeeklyCandidates, scoreWeeklyReadingQuality, isNewswireCandidate } = require("../lib/weekFocusQuality.ts");

function emptyProfile() {
  return {
    category: {},
    a¶»§q«^