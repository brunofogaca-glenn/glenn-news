import { get, list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

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
  title?: string;
  link?: string;
  summary?: string;
};

export type ReaderActivity = ReaderEvent & {
  timestamp: string;
};

const PROFILE_PATH = "glenn-news/profile/default.json";
const EVENT_PREFIX = "glenn-news/profile/events/";
const MAX_PROFILE_BYTES = 32_000;
const MAX_EVENTS = 1000;

const emptyProfile = (): ReaderProfile => ({
  category: {},
  articleType: {},
  source: {},
  topic: {},
  totalClicks: 0,
  lastUpdated: null,
});

function clamp(value: number) {
  return Math.max(0, Math.min(value, 100));
}

function trimMap(map: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
  );
}

function mergeProfiles(
  base: ReaderProfile,
  addition: ReaderProfile
): ReaderProfile {
  const merged = structuredClone(base);

  for (const [key, value] of Object.entries(addition.category)) {
    merged.category[key] = (merged.category[key] ?? 0) + value;
  }

  for (const [key, value] of Object.entries(addition.articleType)) {
    merged.articleType[key] =
      (merged.articleType[key] ?? 0) + value;
  }

  for (const [key, value] of Object.entries(addition.source)) {
    merged.source[key] =
      (merged.source[key] ?? 0) + value;
  }

  for (const [key, value] of Object.entries(addition.topic)) {
    merged.topic[key] =
      (merged.topic[key] ?? 0) + value;
  }

  merged.totalClicks += addition.totalClicks;

  if (
    addition.lastUpdated &&
    (!merged.lastUpdated ||
      addition.lastUpdated > merged.lastUpdated)
  ) {
    merged.lastUpdated = addition.lastUpdated;
  }

  return {
    ...merged,
    category: trimMap(
      Object.fromEntries(
        Object.entries(merged.category).map(([key, value]) => [
          key,
          clamp(value),
        ])
      )
    ),
    articleType: trimMap(
      Object.fromEntries(
        Object.entries(merged.articleType).map(([key, value]) => [
          key,
          clamp(value),
        ])
      )
    ),
    source: trimMap(
      Object.fromEntries(
        Object.entries(merged.source).map(([key, value]) => [
          key,
          clamp(value),
        ])
      )
    ),
    topic: trimMap(
      Object.fromEntries(
        Object.entries(merged.topic).map(([key, value]) => [
          key,
          clamp(value),
        ])
      )
    ),
  };
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

async function getLegacyProfile(): Promise<ReaderProfile> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return emptyProfile();
  }

  try {
    const result = await get(PROFILE_PATH, {
      access: "private",
    });

    if (
      !result?.stream ||
      result.statusCode !== 200
    ) {
      return emptyProfile();
    }

    const text = await new Response(result.stream).text();

    if (text.length > MAX_PROFILE_BYTES) {
      return emptyProfile();
    }

    return JSON.parse(text) as ReaderProfile;
  } catch {
    return emptyProfile();
  }
}

async function getEventProfile(): Promise<ReaderProfile> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return emptyProfile();
  }

  try {
    const result = await list({
      prefix: EVENT_PREFIX,
      limit: MAX_EVENTS,
    });

    const profile = emptyProfile();

    for (const blob of result.blobs) {
      const parts = blob.pathname
        .slice(EVENT_PREFIX.length)
        .split(".");

      if (parts.length !== 6 || parts[5] !== "json") {
        continue;
      }

      const [timestampId, category, articleType, source, topic] =
        parts;

      const timestamp = Number.parseInt(
        timestampId.split("-")[0],
        10
      );

      if (!Number.isFinite(timestamp)) {
        continue;
      }

      const ageDays =
        Math.max(
          0,
          (Date.now() - timestamp) /
            (1000 * 60 * 60 * 24)
        );

      const recencyWeight = Math.max(
        0.15,
        Math.exp(-ageDays / 45)
      );

      const categoryKey = decode(category);
      const articleTypeKey = decode(articleType);
      const sourceKey = decode(source);
      const topicKey = decode(topic);

      profile.category[categoryKey] =
        (profile.category[categoryKey] ?? 0) +
        recencyWeight;

      profile.articleType[articleTypeKey] =
        (profile.articleType[articleTypeKey] ?? 0) +
        recencyWeight * 2;

      profile.source[sourceKey] =
        (profile.source[sourceKey] ?? 0) +
        recencyWeight * 0.5;

      if (topicKey) {
        profile.topic[topicKey] =
          (profile.topic[topicKey] ?? 0) +
          recencyWeight * 1.5;
      }

      profile.totalClicks += 1;

      const eventDate =
        new Date(timestamp).toISOString();

      if (
        !profile.lastUpdated ||
        eventDate > profile.lastUpdated
      ) {
        profile.lastUpdated = eventDate;
      }
    }

    return mergeProfiles(emptyProfile(), profile);
  } catch (error) {
    console.error(
      "Kunde inte läsa reader events:",
      error
    );

    return emptyProfile();
  }
}

export async function getReaderProfile(): Promise<ReaderProfile> {
  const [legacy, events] = await Promise.all([
    getLegacyProfile(),
    getEventProfile(),
  ]);

  return mergeProfiles(legacy, events);
}

export function updateReaderProfile(
  profile: ReaderProfile,
  event: ReaderEvent
): ReaderProfile {
  const next = structuredClone(profile);

  next.category[event.category] =
    (next.category[event.category] ?? 0) + 1;

  next.articleType[event.articleType] =
    (next.articleType[event.articleType] ?? 0) + 2;

  next.source[event.source] =
    (next.source[event.source] ?? 0) + 0.5;

  if (event.topic) {
    const topic = event.topic.trim().slice(0, 80);

    if (topic) {
      next.topic[topic] =
        (next.topic[topic] ?? 0) + 1.5;
    }
  }

  next.totalClicks += 1;
  next.lastUpdated =
    new Date().toISOString();

  return mergeProfiles(
    emptyProfile(),
    next
  );
}

export async function getRecentReaderActivity(
  limit = 20
): Promise<ReaderActivity[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return [];
  }

  try {
    const result = await list({
      prefix: EVENT_PREFIX,
      limit: MAX_EVENTS,
    });

    const recentBlobs = result.blobs
      .sort((a, b) => b.pathname.localeCompare(a.pathname))
      .slice(0, Math.max(1, Math.min(limit, 50)));

    const activity = await Promise.all(
      recentBlobs.map(async blob => {
        const parts = blob.pathname
          .slice(EVENT_PREFIX.length)
          .split(".");

        if (parts.length !== 6 || parts[5] !== "json") {
          return null;
        }

        const timestamp = Number.parseInt(
          parts[0].split("-")[0],
          10
        );

        if (!Number.isFinite(timestamp)) {
          return null;
        }

        const decode = (value: string) =>
          Buffer.from(value, "base64url").toString("utf8");

        let title = "";
        let link = "";

        try {
          const stored = await get(blob.pathname, {
            access: "private",
          });

          if (stored?.stream) {
            const payload = JSON.parse(
              await new Response(stored.stream).text()
            ) as {
              title?: string;
              link?: string;
            };

            title = payload.title?.trim() ?? "";
            link = payload.link ?? "";
          }
        } catch {
          // Older events may only contain metadata in the pathname.
        }

        const topic = decode(parts[4]);

        return {
          timestamp: new Date(timestamp).toISOString(),
          category: decode(parts[1]),
          articleType: decode(parts[2]),
          source: decode(parts[3]),
          topic: topic || undefined,
          title: title || topic || "Läst artikel",
          link: link || undefined,
        };
      })
    );

    const cleaned: ReaderActivity[] = [];
    for (const item of activity) {
      if (item !== null) {
        cleaned.push(item);
      }
    }

    return cleaned;
  } catch (error) {
    console.error(
      "Kunde inte läsa reader activity:",
      error
    );

    return [];
  }
}

export async function getReaderActivitySince(
  sinceIso: string,
  limit = 250
): Promise<ReaderActivity[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return [];
  }

  const cutoff = Date.parse(sinceIso);
  if (!Number.isFinite(cutoff)) {
    return [];
  }

  try {
    const result = await list({
      prefix: EVENT_PREFIX,
      limit: MAX_EVENTS,
    });

    const candidates = result.blobs
      .map(blob => {
        const parts = blob.pathname
          .slice(EVENT_PREFIX.length)
          .split(".");
        if (parts.length !== 6 || parts[5] !== "json") {
          return null;
        }

        const timestamp = Number.parseInt(parts[0].split("-")[0], 10);
        if (!Number.isFinite(timestamp) || timestamp < cutoff || timestamp > Date.now()) {
          return null;
        }

        return { blob, parts, timestamp };
      })
      .filter(
        (item): item is NonNullable<typeof item> => item !== null
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.max(1, Math.min(limit, 300)));

    const decodeValue = (value: string) =>
      Buffer.from(value, "base64url").toString("utf8");

    const activity: ReaderActivity[] = [];

    // Read a small batch at a time to avoid overwhelming Blob when a busy week
    // contains many clicks. All history is read centrally, across devices.
    for (let offset = 0; offset < candidates.length; offset += 20) {
      const batch = candidates.slice(offset, offset + 20);
      const resolved = await Promise.all(batch.map(async item => {
        let title = "";
        let link = "";

        try {
          const stored = await get(item.blob.pathname, {
            access: "private",
          });

          if (stored?.stream && stored.statusCode === 200) {
            const payload = JSON.parse(
              await new Response(stored.stream).text()
            ) as { title?: string; link?: string };

            title = payload.title?.trim() ?? "";
            link = payload.link ?? "";
          }
        } catch {
          // The event path still preserves category, type, source and topic.
        }

        const topic = decodeValue(item.parts[4]);
        return {
          timestamp: new Date(item.timestamp).toISOString(),
          category: decodeValue(item.parts[1]),
          articleType: decodeValue(item.parts[2]),
          source: decodeValue(item.parts[3]),
          topic: topic || undefined,
          title: title || topic || "Läst artikel",
          link: link || undefined,
        } satisfies ReaderActivity;
      }));

      activity.push(...resolved);
    }

    return activity;
  } catch (error) {
    console.error("Kunde inte läsa veckans läshistorik:", error);
    return [];
  }
}

// Kept for backwards compatibility with existing callers.
// New events are append-only and do not overwrite the profile.
export async function saveReaderProfile(
  profile: ReaderProfile
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return false;
  }

  try {
    await put(
      PROFILE_PATH,
      JSON.stringify(profile),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      }
    );

    return true;
  } catch (error) {
    console.error(
      "Kunde inte spara reader profile:",
      error
    );

    return false;
  }
}

export async function recordReaderEvent(
  event: ReaderEvent,
  eventId?: string
) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return false;
  }

  const now = Date.now();
  const match = eventId?.match(/^(\d{13})-([a-f0-9]{32})$/i);
  const requestedTimestamp = match ? Number(match[1]) : Number.NaN;
  const canUseStableId =
    Boolean(match) &&
    Number.isFinite(requestedTimestamp) &&
    requestedTimestamp <= now + 60_000 &&
    requestedTimestamp >= now - 10 * 60_000;

  // Keep the same Blob pathname for a quick retry of the same click. If the
  // supplied ID is absent or stale, fall back to a fresh server-generated ID.
  const timestamp = canUseStableId ? requestedTimestamp : now;
  const id = canUseStableId
    ? match![2].toLowerCase()
    : randomUUID().replaceAll("-", "");

  const pathname = [
    EVENT_PREFIX +
      timestamp +
      "-" +
      id,
    encode(event.category),
    encode(event.articleType),
    encode(event.source),
    encode(event.topic ?? ""),
    "json",
  ].join(".");

  try {
    await put(
      pathname,
      JSON.stringify({
        title: event.title?.trim().slice(0, 300) ?? "",
        link: event.link ?? "",
        summary: event.summary?.trim().slice(0, 1_500) ?? "",
      }),
      {
      access: "private",
      addRandomSuffix: false,
      contentType: "application/json",
    });

    return true;
  } catch (error) {
    console.error(
      "Kunde inte spara reader event:",
      error
    );

    return false;
  }
}
