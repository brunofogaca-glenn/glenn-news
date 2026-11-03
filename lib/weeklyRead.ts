import { get, put } from "@vercel/blob";

const READ_PATH = "glenn-news/profile/weekly-read.json";
const MAX_READ_LINKS = 100;

type WeeklyReadSnapshotResult =
  | { ok: true; links: string[] }
  | { ok: false; links: [] };

/**
 * A read failure must remain distinct from a missing snapshot. The public
 * reader can degrade to an empty list, but a writer must never replace valid
 * weekly history merely because Blob temporarily failed to return it.
 */
async function readWeeklyReadSnapshot(): Promise<WeeklyReadSnapshotResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, links: [] };

  try {
    const result = await get(READ_PATH, { access: "private" });
    // The Blob SDK represents a missing object as null; 404 is not part of
    // the successful result type and is handled only if the SDK throws it.
    if (!result) return { ok: true, links: [] };
    if (!result.stream || result.statusCode !== 200) return { ok: false, links: [] };

    const parsed = JSON.parse(await new Response(result.stream).text()) as unknown;
    if (!Array.isArray(parsed)) return { ok: false, links: [] };

    return {
      ok: true,
      links: parsed
        .filter((value): value is string => typeof value === "string")
        .slice(0, MAX_READ_LINKS),
    };
  } catch (error) {
    if (error && typeof error === "object" &&
        "statusCode" in error && Number(error.statusCode) === 404) {
      return { ok: true, links: [] };
    }
    console.error("Kunde inte läsa weekly read state; befintlig historik lämnas orörd:", error);
    return { ok: false, links: [] };
  }
}

export async function getWeeklyReadLinks() {
  const snapshot = await readWeeklyReadSnapshot();
  return snapshot.ok ? snapshot.links : [];
}

export async function addWeeklyReadLink(link: string) {
  return addWeeklyReadLinks([link]);
}

/** Merge a nightly batch of newly read Week Focus links in one Blob write. */
export async function addWeeklyReadLinks(links: string[]) {
  const uniqueLinks = [...new Set(links.filter(link => /^https?:\/\//i.test(link)))];
  if (!uniqueLinks.length) return true;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;

  const snapshot = await readWeeklyReadSnapshot();
  if (!snapshot.ok) return false;

  const current = snapshot.links;
  const next = [...new Set([...uniqueLinks.slice().reverse(), ...current])].slice(0, MAX_READ_LINKS);
  if (next.length === current.length && next.every((link, index) => link === current[index])) return true;

  try {
    await put(READ_PATH, JSON.stringify(next), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return true;
  } catch (error) {
    console.error("Kunde inte spara weekly read state:", error);
    return false;
  }
}
