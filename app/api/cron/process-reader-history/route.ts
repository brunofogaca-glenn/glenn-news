/**
 * Authenticated nightly reader-history maintenance endpoint.
 *
 * GitHub Actions OIDC authorization is required. Only the restricted migration-marker push
 * may use manual=1 outside the normal window. The job consolidates batches, safely updates the reader-profile snapshot,
 * retries reading-status writes, and precomputes Week Focus only on Saturday.
 */

import { NextResponse } from "next/server";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import {
  getReaderProfileSnapshotForMaintenance,
  processPendingReaderBatches,
  rebuildAndSaveReaderProfileSnapshot,
} from "@/lib/readerProfile";
import { addWeeklyReadLinks } from "@/lib/weeklyRead";
import { createWeeklyFocus } from "@/lib/weekFocus";
import { getStockholmClock } from "@/lib/updateSchedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const authorizedVercelCron = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
  const authorizedGitHubActions = await authorizeGitHubActionsRefresh(request, "readerHistory");
  if (!authorizedVercelCron && !authorizedGitHubActions) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const clock = getStockholmClock();
  // The OIDC helper permits manual=1 only for the restricted migration-marker push.
  const manualRun = new URL(request.url).searchParams.get("manual") === "1";
  // Keep the one-time migration override exclusive to the repository/workflow-scoped OIDC identity.
  if (manualRun && !authorizedGitHubActions) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!manualRun && (clock.hour < 1 || clock.hour >= 6)) {
    return NextResponse.json({
      ok: false,
      skipped: true,
      error: "Reader-history maintenance is only allowed from 01:00 to 05:59 Europe/Stockholm",
      localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    }, { status: 503 });
  }

  try {
    const processed = await processPendingReaderBatches(100);
    const {
      ledgerEvents,
      ledgerAvailable,
      ledgerChanged,
      ledgerUpdatedAt,
      ...processedSummary
    } = processed;
    if (!processed.storageAvailable) {
      return NextResponse.json({ ok: false, error: "Blob storage is unavailable" }, { status: 503 });
    }
    if (!ledgerAvailable) {
      return NextResponse.json({
        ok: false, snapshotUpdated: false,
        error: "Reader-history ledger could not be read or saved safely", ...processedSummary,
      }, { status: 503 });
    }

    const weeklyReadSaved = processedSummary.weeklyReadLinks.length
      ? await addWeeklyReadLinks(processedSummary.weeklyReadLinks)
      : true;
    if (!weeklyReadSaved) {
      return NextResponse.json({
        ok: false, snapshotUpdated: false,
        error: "Week Focus read status could not be saved", ...processed,
      }, { status: 503 });
    }

    const currentSnapshot = manualRun ? null : await getReaderProfileSnapshotForMaintenance();
    const snapshotAlreadyCurrent = Boolean(
      currentSnapshot &&
      ledgerUpdatedAt &&
      currentSnapshot.sourceLedgerUpdatedAt === ledgerUpdatedAt
    );
    const snapshot = snapshotAlreadyCurrent && currentSnapshot
      ? {
          saved: true,
          generatedAt: currentSnapshot.generatedAt,
          profile: currentSnapshot.profile,
          updated: false,
        }
      : {
          ...(await rebuildAndSaveReaderProfileSnapshot(ledgerEvents, ledgerUpdatedAt ?? undefined)),
          updated: true,
        };
    if (!snapshot.saved) {
      return NextResponse.json({
        ok: false, snapshotUpdated: false,
        error: "Reader profile snapshot could not be saved", ...processed,
      }, { status: 503 });
    }

    let weeklyFocusPrecomputed = false;
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Stockholm",
      weekday: "short",
    }).format(new Date());
    if (weekday === "Sat") {
      try {
        // Create the fixed weekend edition overnight, before the reader arrives.
        await createWeeklyFocus(snapshot.profile);
        weeklyFocusPrecomputed = true;
      } catch (error) {
        // Reader-history maintenance remains successful if optional editorial work fails.
        console.warn("Week Focus precomputation failed:", error);
      }
    }

    return NextResponse.json({
      ok: true,
      snapshotUpdated: snapshot.updated,
      snapshotSkipped: !snapshot.updated,
      snapshotGeneratedAt: snapshot.generatedAt,
      weeklyFocusPrecomputed,
      ledgerChanged,
      ledgerUpdatedAt,
      ...processedSummary,
    });
  } catch (error) {
    console.error("Nightly reader-history processing failed:", error);
    return NextResponse.json({ ok: false, error: "Nightly reader-history processing failed" }, { status: 500 });
  }
}
