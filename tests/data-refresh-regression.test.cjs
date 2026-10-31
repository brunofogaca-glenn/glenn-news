const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const ts = require("typescript");
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
const { parseFtBrentHistory } = require("../lib/brentHistoryParser.ts");

test("supplemental Vercel cron and manual recovery use scoped authentication", () => {
  const config = JSON.parse(read("vercel.json"));
  const supplementalCrons = config.crons.filter((cron) => cron.path === "/api/cron/refresh-data");
  assert.deepEqual(
    supplementalCrons.map((cron) => cron.schedule).sort(),
    ["13 0 * * *", "13 1 * * *"]
  );

  const workflow = read(".github/workflows/refresh-supplemental-data.yml");
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /force=1/);
  assert.match(workflow, /hour_num >= 1 && hour_num < 6/);
  assert.match(workflow, /exit 1/);
  assert.match(workflow, /id-token: write/);
  ass¶»§q«^