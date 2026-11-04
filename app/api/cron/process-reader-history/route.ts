/**
 * Authenticated nightly reader-history maintenance endpoint.
 *
 * GitHub Actions OIDC authorization is required. Only the restricted migration-marker push
 * may use manual=1 outside the normal window. The job consolidates batches, safely updates the reader-profile snapshot,
 * and persists the consolidated reading history.
 */

import { NextResponse } from "next/server";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import {
  getReaderProfileSnapshotForMaintenance,
  processPendingReaderBatches,
  rebuildAndSaveReaderProfileSnapshot,
} from "@/lib/readerProfile";
import { getStockholmClock } from "@/lib/updateSchedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = Boolean(cronSecret && authorization === "Bearer " + cronSecret);
  if (!(await authorizeGitHubActionsRefresh(request, "readerHistory"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const clock = getStockholmClock();
  // The migration bypass is reserved for the OIDC-authorized one-time push, never Cron.
  const manualRun = new URL(request.url).searchParams.get("manual") === "1";
  if (manualRun && isVercelCron) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!manualRun && (clo¶»§q«^