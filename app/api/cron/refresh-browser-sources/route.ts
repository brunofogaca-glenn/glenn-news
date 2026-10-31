import { Sandbox } from "@vercel/sandbox";
import {
  GET as getBorasSnapshotStatus,
  POST as ingestBorasSnapshot,
} from "../ingest-boras-events/route";
import {
  GET as getFotbollskanalenSnapshotStatus,
  POST as ingestFotbollskanalenSnapshot,
} from "../ingest-fotbollskanalen-articles/route";
import { getStockholmClock } from "@/lib/updateSchedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPOSITORY_URL = "https://github.com/brunofogaca-glenn/glenn-news";
const PROJECT_ID = "prj_mZabEDP074jUlH246TPxJNSrTbXt";
const PLAYWRIGHT_VERSION = "1.64.1";
const WORKSPACE = "/tmp/glenn-news-browser-refresh";

type JsonRecord = Record<string, unknown>;
type RefreshResult = { status: "updated" | "current" | "failed"; detail?: string; count?: number };

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === "Bearer " + secret);
}

function internalRequest(path: string, method: "GET" | "POST", body?: unknown) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET saknas; intern ingestion kan inte autentiseras.");
  return new Request("https://glenn-news.internal" + path, {
    method,
    headers: {
      authorization: "Bearer " + secret,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function readJson(response: Response): Promise<JsonRecord> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new Error("Ingestion returned a non-JSON response (HTTP " + response.status + ").");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Ingestion returned an invalid response (HTTP " + response.status + ").");
  }
  const record = value as JsonRecord;
  if (!response.ok || record.ok !== true) {
    throw new Error(typeof record.error === "string" ? record.error : "HTTP " + response.status);
  }
  return record;
}

async function runBrowserCommand(sandbox: Sandbox, scriptName: string, outputName: string) {
  const result = await sandbox.runCommand("bash", ["-lc", "cd " + WORKSPACE + " && node " + scriptName]);
  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()).trim().slice(-1500);
    throw new Error(stderr || scriptName + " exited with code " + String(result.exitCode ?? "unknown") + ".");
  }
  const output = await sandbox.readFileToBuffer({ path: WORKSPACE + "/" + outputName });
  if (!output) throw new Error(scriptName + " did not create " + outputName + ".");
  const parsed: unknown = JSON.parse(output.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object from " + scriptName + ".");
  return parsed as JsonRecord;
}

async function prepareSandbox(sandbox: Sandbox) {
  const commands = [
    "set -euo pipefail",
    "mkdir -p " + WORKSPACE,
    "cp /vercel/glenn-news/scripts/scrape-boras-events.mjs " + WORKSPACE + "/",
    "cp /vercel/glenn-news/scripts/scrape-fotbollskanalen-articles.mjs " + WORKSPACE + "/",
    "cd " + WORKSPACE,
    "npm init -y >/dev/null",
    "npm install --no-audit --no-fund --save-exact playwright@" + PLAYWRIGHT_VERSION,
    "npx playwright install --with-deps chromium",
  ];
  const result = await sandbox.runCommand("bash", ["-lc", commands.join(" && ")]);
  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()).trim().slice(-2000);
    throw new Error(stderr || "Playwright sandbox setup exited with code " + String(result.exitCode ?? "unknown") + ".");
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const clock = getStockholmClock();
  if (clock.hour < 1 || clock.hour >= 6) {
    return Response.json({
      ok: false,
      error: "Browser refresh is only allowed from 01:00–05:59 Europe/Stockholm.",
      localTime: String(clock.hour).padStart(2, "0") + ":" + String(clock.minute).padStart(2, "0"),
    }, { status: 503 });
  }

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!commitSha || !/^[a-f0-9]{40}$/i.test(commitSha)) {
    return Response.json({ ok: false, error: "Missing or invalid VERCEL_GIT_COMMIT_SHA." }, { status: 503 });
  }

  const results: { boras: RefreshResult; fotbollskanalen: RefreshResult } = {
    boras: { status: "current" },
    fotbollskanalen: { status: "current" },
  };

  try {
    const [borasStatusResponse, fotbollskanalenStatusResponse] = await Promise.all([
      getBorasSnapshotStatus(internalRequest("/api/cron/ingest-boras-events", "GET")),
      getFotbollskanalenSnapshotStatus(internalRequest("/api/cron/ingest-fotbollskanalen-articles", "GET")),
    ]);
    const [borasStatus, fotbollskanalenStatus] = await Promise.all([
      readJson(borasStatusResponse),
      readJson(fotbollskanalenStatusResponse),
    ]);

    const refreshBoras = borasStatus.shouldRefresh === true;
    const refreshFotbollskanalen = fotbollskanalenStatus.shouldRefresh === true;
    if (!refreshBoras && !refreshFotbollskanalen) {
      return Response.json({
        ok: true,
        skipped: true,
        reason: "Both browser snapshots are already fresh for today's Stockholm date.",
        boras: { status: "current", count: borasStatus.eventCount },
        fotbollskanalen: { status: "current", count: fotbollskanalenStatus.articleCount },
      });
    }

    let sandbox: Sandbox | undefined;
    let borasPayload: JsonRecord | undefined;
    let fotbollskanalenPayload: JsonRecord | undefined;
    let setupError: string | undefined;

    try {
      sandbox = await Sandbox.create({
        projectId: process.env.VERCEL_PROJECT_ID || PROJECT_ID,
        image: "vercel/sandbox/node:22",
        source: { type: "git", url: REPOSITORY_URL, revision: commitSha, depth: 1 },
        region: "arn1",
        resources: { vcpus: 1 },
        timeout: 240_000,
        persistent: false,
        tags: { application: "glenn-news", purpose: "browser-refresh" },
      });

      await prepareSandbox(sandbox);

      if (refreshBoras) {
        try {
          borasPayload = await runBrowserCommand(sandbox, "scrape-boras-events.mjs", "boras-events-scrape.json");
        } catch (error) {
          results.boras = { status: "failed", detail: error instanceof Error ? error.message : String(error) };
        }
      }
      if (refreshFotbollskanalen) {
        try {
          fotbollskanalenPayload = await runBrowserCommand(
            sandbox,
            "scrape-fotbollskanalen-articles.mjs",
            "fotbollskanalen-articles.json"
          );
        } catch (error) {
          results.fotbollskanalen = { status: "failed", detail: error instanceof Error ? error.message : String(error) };
        }
      }
    } catch (error) {
      setupError = error instanceof Error ? error.message : String(error);
    } finally {
      if (sandbox) {
        try {
          await sandbox.stop();
        } catch (error) {
          console.warn("[browser-refresh] Sandbox cleanup failed:", error);
        }
      }
    }

    if (setupError) {
      return Response.json({
        ok: false,
        error: "Could not prepare the isolated browser runtime.",
        detail: setupError.slice(0, 1500),
        boras: refreshBoras ? { status: "failed" } : results.boras,
        fotbollskanalen: refreshFotbollskanalen ? { status: "failed" } : results.fotbollskanalen,
      }, { status: 503 });
    }

    if (borasPayload) {
      try {
        const stored = await readJson(await ingestBorasSnapshot(internalRequest(
          "/api/cron/ingest-boras-events", "POST", { events: borasPayload.events }
        )));
        results.boras = {
          status: stored.skipped === true ? "current" : "updated",
          count: typeof stored.stored === "number" ? stored.stored : undefined,
        };
      } catch (error) {
        results.boras = { status: "failed", detail: error instanceof Error ? error.message : String(error) };
      }
    }

    if (fotbollskanalenPayload) {
      try {
        const stored = await readJson(await ingestFotbollskanalenSnapshot(internalRequest(
          "/api/cron/ingest-fotbollskanalen-articles", "POST", { articles: fotbollskanalenPayload.articles }
        )));
        results.fotbollskanalen = {
          status: stored.skipped === true ? "current" : "updated",
          count: typeof stored.stored === "number" ? stored.stored : undefined,
        };
      } catch (error) {
        results.fotbollskanalen = { status: "failed", detail: error instanceof Error ? error.message : String(error) };
      }
    }

    const ok = results.boras.status !== "failed" && results.fotbollskanalen.status !== "failed";
    console.info("[browser-refresh] completed", {
      ok, boras: results.boras.status, fotbollskanalen: results.fotbollskanalen.status, commitSha,
    });
    return Response.json({ ok, boras: results.boras, fotbollskanalen: results.fotbollskanalen }, { status: ok ? 200 : 503 });
  } catch (error) {
    console.error("[browser-refresh] refresh failed:", error);
    return Response.json({
      ok: false,
      error: "Browser-source refresh failed.",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 503 });
  }
}
