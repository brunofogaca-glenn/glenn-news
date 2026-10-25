import { get, list, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { recordDiagnostic } from "./diagnosticLog";

export type ReaderProfile = {
  category: Record<string, number>;
  articleType: Record<string, number>;
  source: Record<string, number>;
  topic: Record<string, number>;
  semanticCategory?: Record<string, number>;
  semanticArticleType?: Record<string, number>;
  semanticTopic?: Record<string, number>;
  semanticTag?: Record<string, number>;
  entity?: Record<string, number>;
  geography?: Record<string, number>;
  eventKey?: Record<string, number>;
  semanticClicks?: number;
  totalClicks: number;
  lastUpdated: string | null;
};

export type SemanticReaderClassification = {
  broadCategory: string;
  mainTopic: string;
  tags: string[];
  entities: Array<{ name: string; kind: string }>;
  geography: {
    country: string | null;
    region: string | null;
    city: string | null;
  };
  articleType: string;
  eventKey: string;
  confidence: number;
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
const SEMANTIC_EVENT_PREFIX = "glenn-news/profile/semantic-events/";
const BATCH_EVENT_PREFIX = "glenn-news/profile/batches/";
const MAX_PROFILE_BYTES = 32_000;
const MAX_EVENTS = 1000;

const emptyProfile = (): ReaderProfile => ({
  category: {},
  articleType: {},
  source: {},
  topic: {},
  semanticCategory: {},
  semanticArticleType: {},
  semanticTopic: {},
  semanticTag: {},
  entity: {},
  geography: {},
  eventKey: {},
  semanticClicks: 0,
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

function trimWeightedMap(map?: Record<string, number>) {
  return trimMap(
    Object.fromEntries(
      Object.entries(map ?? {}).map(([key, value]) => [key, clamp(value)])
    )
  );
}

function addWeightedValue(map: Record<string, number>, value: unknown, weight: number) {
  if (typeof value !== "string") return;
  const key = value.trim().toLocaleLowerCase("sv-SE").slice(0, 90);
  if (key.length < 2 || !Number.isFinite(weight) || weight <= 0) return;
  map[key] = (map[key] ?? 0) + weight;
}

function mergeWeightedMaps(
  base?: Record<string, number>,
  addition?: Record<string, number>
): Record<string, number> {
  const merged = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(addition ?? {})) {
    merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

function mergeProfiles(
  base: ReaderProfile,
  addition: ReaderProfile
): ReaderProfile {
  // Backfill semantic maps for profiles saved before semantic classification existed.
  const merged: ReaderProfile = {
    ...emptyProfile(),
    ...structuredClone(base),
    semanticCategory: { ...(base.semanticCategory ?? {}) },
    semanticArticleType: { ...(base.semanticArticleType ?? {}) },
    semanticTopic: { ...(base.semanticTopic ?? {}) },
    semanticTag: { ...(base.semanticTag ?? {}) },
    entity: { ...(base.entity ?? {}) },
    geography: { ...(base.geography ?? {}) },
    eventKey: { ...(base.eventKey ?? {}) },
    semanticClicks: base.semanticClicks ?? 0,
  };

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

  merged.semanticCategory = mergeWeightedMaps(merged.semanticCategory, addition.semanticCategory);
  merged.semanticArticleType = mergeWeightedMaps(merged.semanticArticleType, addition.semanticArticleType);
  merged.semanticTopic = mergeWeightedMaps(merged.semanticTopic, addition.semanticTopic);
  merged.semanticTag = mergeWeightedMaps(merged.semanticTag, addition.semanticTag);
  merged.entity = mergeWeightedMaps(merged.entity, addition.entity);
  merged.geography = mergeWeightedMaps(merged.geography, addition.geography);
  merged.eventKey = mergeWeightedMaps(merged.eventKey, addition.eventKey);
  merged.semanticClicks = (merged.semanticClicks ?? 0) + (addition.semanticClicks ?? 0);

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
    semanticCategory: trimWeightedMap(merged.semanticCategory),
    semanticArticleType: trimWeightedMap(merged.semanticArticleType),
    semanticTopic: trimWeightedMap(merged.semanticTopic),
    semanticTag: trimWeightedMap(merged.semanticTag),
    entity: trimWeightedMap(merged.entity),
    geography: trimWeightedMap(merged.geography),
    eventKey: trimWeightedMap(merged.eventKey),
    semanticClicks: merged.semanticClicks ?? 0,
  };
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export type BatchedReaderEvent = ReaderEvent & { eventId: string; timestamp: string; classification?: SemanticReaderClassification | null };

export async function recordReaderBatch(batchId: string, events: BatchedReaderEvent[]): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !/^[0-9]{13}-[a-f0-9]{32}$/i.test(batchId) || events.length < 1 || events.length > 50) return false;
  try {
    await put(BATCH_EVENT_PREFIX + batchId + ".json", JSON.stringify({ version: 1, events }), {
      access: "private", addRandomSuffix: false, contentType: "application/json",
    });
    return true;
  } catch (error) {
    console.error("Kunde inte spara läshistorikens batch:", error);
    return false;
  }
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

    const batches = await list({ prefix: BATCH_EVENT_PREFIX, limit: MAX_EVENTS });
    for (const blob of batches.blobs) {
      try {
        const stored = await get(blob.pathname, { access: "private" });
        if (!stored?.stream || stored.statusCode !== 200) continue;
        const parsed = JSON.parse(await new Response(stored.stream).text()) as { events?: BatchedReaderEvent[] };
        for (const item of parsed.events ?? []) {
          const stamp = Date.parse(item.timestamp);
          if (!Number.isFinite(stamp) || stamp > Date.now() + 60000) continue;
          const age = Math.max(0, (Date.now() - stamp) / 86400000);
          const w = Math.max(0.15, Math.exp(-age / 45));
          profile.category[item.category] = (profile.category[item.category] ?? 0) + w;
          profile.articleType[item.articleType] = (profile.articleType[item.articleType] ?? 0) + w * 2;
          profile.source[item.source] = (profile.source[item.source] ?? 0) + w * 0.5;
          if (item.topic) profile.topic[item.topic] = (profile.topic[item.topic] ?? 0) + w * 1.5;
          profile.totalClicks += 1;
          const iso = new Date(stamp).toISOString();
          if (!profile.lastUpdated || iso > profile.lastUpdated) profile.lastUpdated = iso;
        }
      } catch { /* Keep processing other batches. */ }
    }
    return mergeProfiles(emptyProfile(), profile);
  } catch (error) {
    await recordDiagnostic({ level: "error", component: "readerProfile.read", message: "Kunde inte läsa läsarprofilens klickhistorik", error, context: { operation: "read-profile-events" } });
    console.error(
      "Kunde inte läsa reader events:",
      error
    );

    return emptyProfile();
  }
}


/**
 * Create a lightweight semantic index entry whose features are available from
 * the Blob listing itself. This avoids downloading every event body every time
 * the reader profile is rebuilt.
 */
export async function recordSemanticReaderEvent(
  eventId: string,
  classification: SemanticReaderClassification
): Promise<boolean> {
  if (
    !process.env.BLOB_READ_WRITE_TOKEN ||
    !/^\d{13}-[a-f0-9]{32}$/i.test(eventId)
  ) {
    return false;
  }

  const geography = classification.geography ?? {
    country: null,
    region: null,
    city: null,
  };
  const compact = {
    c: classification.broadCategory.trim().toLowerCase().slice(0, 18),
    t: classification.mainTopic.trim().toLocaleLowerCase("sv-SE").slice(0, 48),
    g: classification.tags.slice(0, 4)
      .map(value => value.trim().toLocaleLowerCase("sv-SE").slice(0, 42))
      .filter(Boolean),
    e: classification.entities.slice(0, 3).map(item => [
      item.name.trim().toLocaleLowerCase("sv-SE").slice(0, 42),
      item.kind.trim().toLowerCase().slice(0, 12),
    ]),
    p: [geography.country, geography.region, geography.city]
      .filter((value): value is string => Boolean(value))
      .map(value => value.trim().toLocaleLowerCase("sv-SE").slice(0, 32)),
    a: classification.articleType.trim().toLocaleLowerCase("sv-SE").slice(0, 20),
    v: classification.eventKey.trim().toLocaleLowerCase("sv-SE").slice(0, 55),
    q: Number.isFinite(classification.confidence)
      ? Math.max(0, Math.min(1, classification.confidence))
      : 0.5,
  };
  const encoded = encode(JSON.stringify(compact));
  if (encoded.length > 1_600) {
    console.warn("Semantic reader index entry exceeded the safe pathname budget.");
    return false;
  }

  try {
    await put(
      SEMANTIC_EVENT_PREFIX + eventId + "." + encoded + ".json",
      JSON.stringify({ version: 1 }),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      }
    );
    return true;
  } catch (error) {
    console.warn("Kunde inte spara semantisk läsarhändelse:", error);
    return false;
  }
}

function addSemanticWeight(
  profile: ReaderProfile,
  key: "semanticCategory" | "semanticArticleType" | "semanticTopic" | "semanticTag" | "entity" | "geography" | "eventKey",
  value: unknown,
  weight: number
) {
  const map = profile[key] ?? {};
  addWeightedValue(map, value, weight);
  profile[key] = map;
}

async function getSemanticEventProfile(): Promise<ReaderProfile> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return emptyProfile();

  try {
    const result = await list({
      prefix: SEMANTIC_EVENT_PREFIX,
      limit: MAX_EVENTS,
    });
    const profile = emptyProfile();
    const now = Date.now();

    for (const blob of result.blobs) {
      const parts = blob.pathname.slice(SEMANTIC_EVENT_PREFIX.length).split(".");
      if (parts.length !== 3 || parts[2] !== "json") continue;
      if (!/^\d{13}-[a-f0-9]{32}$/i.test(parts[0])) continue;

      const timestamp = Number.parseInt(parts[0].slice(0, 13), 10);
      if (!Number.isFinite(timestamp) || timestamp > now + 60_000) continue;

      let compact: unknown;
      try {
        compact = JSON.parse(decode(parts[1]));
      } catch {
        continue;
      }
      if (typeof compact !== "object" || compact === null || Array.isArray(compact)) {
        continue;
      }

      const data = compact as {
        c?: unknown; t?: unknown; g?: unknown; e?: unknown; p?: unknown;
        a?: unknown; v?: unknown; q?: unknown;
      };
      const ageDays = Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
      const recencyWeight = Math.max(0.15, Math.exp(-ageDays / 45));
      const confidence = typeof data.q === "number" && Number.isFinite(data.q)
        ? Math.max(0, Math.min(1, data.q))
        : 0.5;
      const weight = recencyWeight * (0.4 + confidence * 0.6);

      addSemanticWeight(profile, "semanticCategory", data.c, weight * 0.5);
      addSemanticWeight(profile, "semanticArticleType", data.a, weight * 0.7);
      addSemanticWeight(profile, "semanticTopic", data.t, weight * 1.4);
      addSemanticWeight(profile, "eventKey", data.v, weight * 0.35);

      if (Array.isArray(data.g)) {
        for (const tag of data.g) {
          addSemanticWeight(profile, "semanticTag", tag, weight * 0.7);
        }
      }

      if (Array.isArray(data.e)) {
        for (const item of data.e) {
          if (!Array.isArray(item) || typeof item[0] !== "string") continue;
          addSemanticWeight(profile, "entity", item[0], weight * 1.2);
        }
      }

      if (Array.isArray(data.p)) {
        for (const place of data.p) {
          addSemanticWeight(profile, "geography", place, weight * 0.3);
        }
      }

      profile.semanticClicks = (profile.semanticClicks ?? 0) + 1;
    }

    return mergeProfiles(emptyProfile(), profile);
  } catch (error) {
    console.warn("Kunde inte läsa semantisk läsarprofil:", error);
    return emptyProfile();
  }
}


// Glenn typically reads for about 30 minutes per morning session. Keep the
// merged profile cached for that whole session to avoid repeatedly listing the
// same Blob event prefixes during article browsing. Click events are still
// recorded independently; this cache is per warm server instance.
const READER_PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;
let readerProfileCache: { expiresAt: number; value: ReaderProfile } | null = null;
let readerProfileInFlight: Promise<ReaderProfile> | null = null;

export async function getReaderProfile(): Promise<ReaderProfile> {
  const now = Date.now();
  if (readerProfileCache && readerProfileCache.expiresAt > now) {
    return structuredClone(readerProfileCache.value);
  }

  if (readerProfileInFlight) {
    return structuredClone(await readerProfileInFlight);
  }

  readerProfileInFlight = (async () => {
    const [legacy, events, semanticEvents] = await Promise.all([
      getLegacyProfile(),
      getEventProfile(),
      getSemanticEventProfile(),
    ]);
    return mergeProfiles(mergeProfiles(legacy, events), semanticEvents);
  })();

  try {
    const profile = await readerProfileInFlight;
    readerProfileCache = {
      expiresAt: Date.now() + READER_PROFILE_CACHE_TTL_MS,
      value: profile,
    };
    return structuredClone(profile);
  } finally {
    readerProfileInFlight = null;
  }
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
        allowOverwrite: true,
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
