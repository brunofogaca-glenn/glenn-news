import { Sandbox } from "@vercel/sandbox";
import {
  GET as getBorasSnapshotStatus,
  POST as ingestBorasSnapshot,
} from "../ingest-boras-events/route";
import { getStockholmClock } from "@/lib/updateSchedule";
import { BORAS_EVENT_HORIZON_DAYS } from "@/lib/borasEventCatalog";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPOSITORY_URL = "https://github.com/brunofogaca-glenn/glenn-news";
const PROJECT_ID = "prj_mZabEDP074jUlH246TPxJNSrTbXt";
const PLAYWRIGHT_VERSION = "1.64.1";
const WORKSPACE = "/tmp/glenn-news-boras-refresh";

type JsonRecord = Record<string, unknown>;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === "Bearer " + secret);
}

function internalRequest(path: string, method: "GET" | "POST", body?: unknown) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET saknas; intern Borås-ingestion kan inte autentiseras.");
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
    throw new Error("Borås-ingestion returned a non-JSON response (HTTP " + response.status + ").");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Borås-ingestion returned an invalid response (HTTP " + response.status + ").");
  }
  const record = value as JsonRecord;
  if (!response.ok || record.ok !== true) {
    throw new Error(typeof record.error === "string" ? record.error : "HTTP " + response.status);
  }
  return record;
}

async function prepareSandbox(sandbox: Sandbox) {
  const commands = [
    "set -euo pipefail",
    "mkdir -p " + WORKSPACE,
    "cp /vercel/glenn-news/scripts/scrape-boras-events.mjs " + WORKSPACE + "/",
    "cd " + WORKSPACE,
    "npm init -y >/dev/null",
    "npm install --no-audit --no-fund --save-exact playwright@" + PLAYWRIGHT_VERSION,
    "npx playwright install --with-deps chromium",
  ];
  const result = await sandbox.runCommand("bash", ["-lc", commands.join(" && ")]);
  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()).trim().slice(-2000);
    throw new Error(stderr || "Playwright Sandbox setup exited with code " + String(result.exitCode ?? "unknown") + ".");
  }
}

async function scrapeBoras(sandbox: Sandbox): Promise<JsonRecord> {
  const command = "cd " + WORKSPACE + " && BORAS_EVENTS_HORIZON_DAYS=" + BORAS_EVENT_HORIZON_DAYS + " node scrape-boras-events.mjs";
  const result = await sandbox.runCommand("bash", ["-lc", command]);
  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()).trim().slice(-1500);
    throw new Error(stderr || "Borås scraper exited with code " + String(result.exitCode ?? "unknown") + ".");
  }
  const output = await sandbox.readFileToBuffer({ path: WORKSPACE + "/boras-events-scrape.json" });
  if (!output) throw new Error("Borås scraper did not create boras-events-scrape.json.");
  const parsed: unknown = JSON.parse(output.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object from the Borås scraper.");
  }
  return parsed as JsonRecord;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const clock = getStockholmClock();
  if (clock.hour < 1 || clock.hour >= 6) {
    return Response.json({
      ok: false,
      error: "Borås refresh is only allowed from 01:00–05:59 Europe/Stockholm.",
      localTime: String(clock.hour).padStart(2, "0") + ":" + String(clock.minute).padStart(2, "0"),
    }, { status: 503 });
  }

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (!commitSha || !/^[a-f0-9]{40}$/i.test(commitSha)) {
    return Response.json({ ok: false, error: "Missing or invalid VERCEL_GIT_COMMIT_SHA." }, { status: 503 });
  }

  try {
    const status = await readJson(await getBorasSnapshotStatus(
      internalRequest("/api/cron/ingest-boras-events", "GET")
    ));
    if (status.shouldRefresh !== true) {
      return Response.json({
        ok: true,
        skipped: true,
        reason: "Today's Borås.com snapshot is already current.",
        boras: { status: "current", count: status.eventCount },
      });
    }

    let sandbox: Sandbox | undefined;
    let payload: JsonRecord;
    try {
      sandbox = await Sandbox.create({
        projectId: process.env.VERCEL_PROJECT_ID || PROJECT_ID,
        image: "vercel/sandbox/node:22",
        source: { type: "git", url: REPOSITORY_URL, revision: commitSha, depth: 1 },
        region: "arn1",
        resources: { vcpus: 1 },
        timeout: 240_000,
        persistent: false,
        tags: { application: "glenn-news", purpose: "boras-browser-refresh" },
      });
      await prepareSandbox(sandbox);
      payload = await scrapeBoras(sandbox);
    } finally {
      if (sandbox) {
        try {
          await sandbox.stop();
        } catch (error) {
          console.warn("[boras-refresh] Sandbox cleanup failed:", error);
        }
      }
    }

    const stored = await readJson(await ingestBorasSnapshot(internalRequest(
      "/api/cron/ingest-boras-events",
      "POST",
      {
        events: payload.events,
        complete: payload.complete,
        expectedHorizonDays: payload.expectedHorizonDays,
      }
    )));

    const result = {
      status: stored.skipped === true ? "current" : "updated",
      count: typeof stored.stored === "number" ? stored.stored : undefined,
      savedAt: typeof stored.savedAt === "string" ? stored.savedAt : undefined,
    };
    console.info("[boras-refresh] completed", { ok: true, ...result, commitSha });
    return Response.json({ ok: true, boras: result });
  } catch (error) {
    console.error("[boras-refresh] refresh failed:", error);
    return Response.json({
      ok: false,
      error: "Borås.com refresh failed.",
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 503 });
  }
}
