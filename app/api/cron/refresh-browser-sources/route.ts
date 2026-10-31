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

async function readJso¶»§q«^