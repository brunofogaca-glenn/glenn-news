import { get, put } from "@vercel/blob";

const READ_PATH = "glenn-news/profile/weekly-read.json";
const MAX_READ_LINKS = 100;

export async function getWeeklyReadLinks() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [] as string[];
  try {
    const result = await get(READ_PATH, { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return [];
    const parsed = JSON.parse(await new Response(result.stream).text()) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, MAX_READ_LINKS)
      : [];
  } catch { return []; }
}

export async function addWeeklyReadLink(link: string) {
  const current = await getWeeklyReadLinks();
  const next = [link, ...current.filter(item => item !== link)].slice(0, MAX_READ_LINKS);
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await put(READ_PATH, JSON.stringify(next), {
      access: "private", addRandomSuffix: false, contentType: "application/json"
    });
    return true;
  } catch (error) {
    console.error("Kunde inte spara weekly read state:", error);
    return false;
  }
}
