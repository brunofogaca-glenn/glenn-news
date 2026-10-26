import { NextResponse } from "next/server";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import {
  processPendingReaderBatches,
  rebuildAndSaveReaderProfileSnapshot,
} from "@/lib/readerProfile";
import { addWeeklyReadLinks } from "@/lib/weeklyRead";
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
    if (!processed.storageAvailable) {
      return NextResponse.json({ ok: false, error: "Blob storage is unavailable" }, { status: 503 });
    }
    if (processed.pendingEvents > 0) {
      return NextResponse.json({ ok: false, snapshotUpdated: false, ...processed }, { status: 503 });
    }

    const weeklyReadSaved = processed.weeklyReadLinks.length
      ? await addWeeklyReadLinks(processed.weeklyReadLinks)
      : true;
    if (!weeklyReadSaved) {
      return NextResponse.json({
        ok: false, snapshotUpdated: false,
        error: "Week Focus read status could not be saved", ...processed,
      }, { status: 503 });
    }

    const snapshot = await rebuildAndSaveReaderProfileSnapshot();
    if (!snapshot.saved) {
      return NextResponse.json({
        ok: false, snapshotUpdated: false,
        error: "Reader profile snapshot could not be saved", ...processed,
      }, { status: 503 });
    }

    return NextResponse.json({
      ok: true, snapshotUpdated: true, snapshotGeneratedAt: snapshot.generatedAt, ...processed,
    });
  } catch (error) {
    console.error("Nightly reader-history processing failed:", error);
    return NextResponse.json({ ok: false, error: "Nightly reader-history processing failed" }, { status: 500 });
  }
}
