import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DOCUMENTATION_FILES = new Set(["README.md", "AGENTS.md", "CLAUDE.md"]);

/**
 * Only Markdown-only changes can skip a deployment. Empty/unknown changes and all
 * application, config, tests, scripts, workflow, or lockfile edits must build.
 */
export function shouldIgnoreVercelBuild(changedPaths) {
  return changedPaths.length > 0 && changedPaths.every(path => {
    const normalized = path.replaceAll("\\", "/");
    return DOCUMENTATION_FILES.has(normalized) ||
      (normalized.startsWith("docs/") && normalized.endsWith(".md"));
  });
}

function runIgnoreCheck() {
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA;

  // Build unless both references are available. Skipping is an optimization, never
  // a dependency for a successful or safe deployment.
  if (!previousSha || !currentSha || previousSha === currentSha) {
    console.log("Vercel change range is unavailable; running the normal build.");
    return 1;
  }

  try {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", `${previousSha}...${currentSha}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    const changedPaths = output.split(/\r?\n/).filter(Boolean);
    if (shouldIgnoreVercelBuild(changedPaths)) {
      console.log("Skipping Vercel build: this commit changes Markdown documentation only.");
      return 0;
    }
    console.log("Build required: application or non-documentation files changed.");
    return 1;
  } catch {
    console.warn("Could not calculate the Git diff; running the normal build.");
    return 1;
  }
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : "";
if (entrypoint === fileURLToPath(import.meta.url)) {
  process.exitCode = runIgnoreCheck();
}
