import { NextResponse } from "next/server";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import {
  processPendingReaderBatches,
  rebuildAndSaveReaderProfileSnapshot,
} from "@/lib/readerProfile";
import { addWeeklyReadLinks } from "@/lib/weeklyRead";
import { createWeeklyFocus } from "@/lib/weekFocus";
import { getStockholmClock } from "@/lib/updateSchedule";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!(await authorizeGitHubActionsRefresh(request, "readerHistory"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const clock = getStockholmClock();
  if (clock.hour < 1 || clock.hour >= 6) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Reader-history maintenance runs only from 01:00 to 05:59 Europe/Stockholm",
      localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}`,
    });
  }

  try {
    const processed = await processPendingReaderBatches(100);
    const { ledgerEvents, ledgerAvailable, ledgerChanged, ...processedSummary } = processed;
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

    const snapshot = await rebuildAndSaveReaderProfileSnapshot(ledgerEvents);
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
      ok: true, snapshotUpdated: true, snapshotGeneratedAt: snapshot.generatedAt,
      weeklyFocusPrecomputed, ledgerChanged, ...processedSummary,
    });
  } catch (error) {
    console.error("Nightly reader-history processing failed:", error);
    return NextResponse.json({ ok: false, error: "Nightly reader-history processing failed" }, { status: 500 });
  }
}
