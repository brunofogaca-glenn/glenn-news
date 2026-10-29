const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workflowPath = path.join(__dirname, "..", ".github", "workflows", "report-failed-workflows.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

test("only failed main-branch workflow runs create production incidents", () => {
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'failure'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow, /github\.event\.workflow_run\.event != 'pull_request'/);
});

test("a recurring failure updates an open issue or reopens its closed fingerprint", () => {
  assert.match(workflow, /gh issue list --state open/);
  assert.match(workflow, /gh issue list --state closed/);
  assert.match(workflow, /select\(\.title == \$title\)/);
  assert.match(workflow, /gh issue comment "\$existing_open_number" --body "\$body"/);
  assert.match(workflow, /gh issue reopen "\$existing_closed_number" --comment "\$body"/);
  assert.match(workflow, /gh issue create --title "\$title" --body "\$body"/);
  assert.doesNotMatch(workflow, /head -n 1/);
});

test("incident reports link to run metadata without copying raw logs or secrets", () => {
  assert.match(workflow, /\*\*Run:\*\* \[#\$\{SOURCE_RUN_NUMBER\}\]\(\$\{run_url\}\)/);
  assert.match(workflow, /Raw log excerpts, tokens, environment variables and request payloads are intentionally not copied into issues\./);
  assert.doesNotMatch(workflow, /gh\s+run\s+view[^\n]*--log/);
  assert.doesNotMatch(workflow, /printenv|GITHUB_ENV|VERCEL_AUTOMATION_BYPASS_SECRET/);
});
