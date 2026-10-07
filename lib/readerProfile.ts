// Production baseline restored from known-good deployment cd70db3.
import { get, put } from "@vercel/blob";

export type ReaderProfile = {
  category: Record<string, number>;
  articleType: Record<string, number>;
  source: Record<string, number>;
  topic: Record<string, number>;
  totalClicks: number;
  lastUpdated: string | null;
};

export type ReaderEvent = {
  category: string;
  articleType: string;
  source: string;
  topic?: string;
};

const PROFILE_PATH = "glenn-news/profile/default.json";
const MAX_KEYS = 24;
const MAX_PROFILE_BYTES = 32_000;

const emptyProfile = (): ReaderProfile => ({
  category: {}, articleType: {}, source: {}, topic: {}, totalClicks: 0, lastUpdated: null,
});

function clamp(value: number) { return Math.max(0, Math.min(value, 100)); }
function trimMap(map: Record<string, number>) {
  return Object.fromEntries(Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, MAX_KEYS));
}

export function emptyReaderProfile(): ReaderProfile { return emptyProfile(); }

export async function getReaderProfile(): Promise<ReaderProfile> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return emptyProfile();
  try {
    const result = await get(PROFILE_PATH, { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return emptyProfile();
    const text = await new Response(result.stream).text();
    if (text.length > MAX_PROFILE_BYTES) return emptyProfile();
    const parsed = JSON.parse(text) as Partial<ReaderProfile>;
    return {
      category: parsed.category ?? {}, articleType: parsed.articleType ?? {}, source: parsed.source ?? {},
      topic: parsed.topic ?? {}, totalClicks: Number(parsed.totalClicks ?? 0), lastUpdated: parsed.lastUpdated ?? null,
    };
  } catch { return emptyProfile(); }
}

export function updateReaderProfile(profile: ReaderProfile, event: ReaderEvent): ReaderProfile {
  const next = structuredClone(profile);
  next.category[event.category] = (next.category[event.category] ?? 0) + 1;
  next.articleType[event.articleType] = (next.articleType[event.articleType] ?? 0) + 2;
  next.source[event.source] = (next.source[event.source] ?? 0) + 0.5;
  if (event.topic) {
    const topic = event.topic.trim().slice(0, 80);
    if (topic) next.topic[topic] = (next.topic[topic] ?? 0) + 1.5;
  }
  next.totalClicks += 1;
  next.lastUpdated = new Date().toISOString();
  next.category = trimMap(Object.fromEntries(Object.entries(next.category).map(([k,v]) => [k, clamp(v)])));
  next.articleType = trimMap(Object.fromEntries(Object.entries(next.articleType).map(([k,v]) => [k, clamp(v)])));
  next.source = trimMap(Object.fromEntries(Object.entries(next.source).map(([k,v]) => [k, clamp(v)])));
  next.topic = trimMap(Object.fromEntries(Object.entries(next.topic).map(([k,v]) => [k, clamp(v)])));
  return next;
}

export async function saveReaderProfile(profile: ReaderProfile) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  try {
    await put(PROFILE_PATH, JSON.stringify(profile), {
      access: "private", addRandomSuffix: false, contentType: "application/json"
    });
    return true;
  } catch (error) {
    console.error("Kunde inte spara reader profile:", error);
    return false;
  }
}
