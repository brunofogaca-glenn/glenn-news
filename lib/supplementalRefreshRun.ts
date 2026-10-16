import { get, put } from "@vercel/blob";

export type SupplementalRefreshSourceStatus = {
  name: string;
  status: string;
  lastSuccessAt: string | null;
  persistent: boolean;
  error: string | null;
};

export type SupplementalRefreshRun = {
  checkedAt: string;
  localTime: string;
  ok: boolean;
  refreshed: boolean;
  cadence: string;
  articleFeedsTouched: false;
  refreshedSources: number;
  failures: number;
  stale: number;
  sources: SupplementalRefreshSourceStatus[];
};

const PATH = "glenn-news/supplemental-refresh/latest.json";

export async function saveSupplementalRefreshRun(value: SupplementalRefreshRun) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await put(PATH, JSON.stringify(value), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return true;
  } catch (error) {
    console.warn("Kunde inte spara status för kompletterande datakällor:", error);
    return false;
  }
}

export async function getSupplementalRefreshRun(): Promise<SupplementalRefreshRun | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const result = await get(PATH, { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;

    const text = await new Response(result.stream).text();
    if (text.length > 30_000) return null;
    const value = JSON.parse(text) as Partial<SupplementalRefreshRun>;

    if (
      typeof value.checkedAt !== "string" ||
      typeof value.localTime !== "string" ||
      typeof value.ok !== "boolean" ||
      !Array.isArray(value.sources)
    ) return null;

    return value as SupplementalRefreshRun;
  } catch {
    return null;
  }
}
