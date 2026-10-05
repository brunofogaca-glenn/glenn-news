import { cookies } from "next/headers";

export type ReaderProfile = {
  category: Record<string, number>;
  articleType: Record<string, number>;
  source: Record<string, number>;
  topic: Record<string, number>;
  totalClicks: number;
  lastUpdated: string | null;
};

const COOKIE_NAME = "glenn-reader-profile";
const MAX_KEYS = 8;

function clamp(value: number) {
  return Math.max(0, Math.min(value, 100));
}

function trimMap(map: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_KEYS)
  );
}

export function emptyReaderProfile(): ReaderProfile {
  return {
    category: {},
    articleType: {},
    source: {},
    topic: {},
    totalClicks: 0,
    lastUpdated: null,
  };
}

export async function getReaderProfile(): Promise<ReaderProfile> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;

    if (!raw) {
      return emptyReaderProfile();
    }

    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as Partial<ReaderProfile>;

    return {
      category: parsed.category ?? {},
      articleType: parsed.articleType ?? {},
      source: parsed.source ?? {},
      topic: parsed.topic ?? {},
      totalClicks: Number(parsed.totalClicks ?? 0),
      lastUpdated: parsed.lastUpdated ?? null,
    };
  } catch {
    return emptyReaderProfile();
  }
}

export function updateReaderProfile(
  profile: ReaderProfile,
  event: {
    category: string;
    articleType: string;
    source: string;
    topic?: string;
  }
): ReaderProfile {
  const next = structuredClone(profile);

  next.category[event.category] =
    (next.category[event.category] ?? 0) + 1;

  next.articleType[event.articleType] =
    (next.articleType[event.articleType] ?? 0) + 2;

  next.source[event.source] =
    (next.source[event.source] ?? 0) + 0.5;

  if (event.topic) {
    const topic = event.topic.trim().slice(0, 60);

    if (topic) {
      next.topic[topic] =
        (next.topic[topic] ?? 0) + 1.5;
    }
  }

  next.totalClicks += 1;
  next.lastUpdated = new Date().toISOString();

  next.category = trimMap(
    Object.fromEntries(
      Object.entries(next.category).map(
        ([key, value]) => [
          key,
          clamp(value),
        ]
      )
    )
  );

  next.articleType = trimMap(
    Object.fromEntries(
      Object.entries(next.articleType).map(
        ([key, value]) => [
          key,
          clamp(value),
        ]
      )
    )
  );

  next.source = trimMap(
    Object.fromEntries(
      Object.entries(next.source).map(
        ([key, value]) => [
          key,
          clamp(value),
        ]
      )
    )
  );

  next.topic = trimMap(
    Object.fromEntries(
      Object.entries(next.topic).map(
        ([key, value]) => [
          key,
          clamp(value),
        ]
      )
    )
  );

  return next;
}

export function serializeReaderProfile(
  profile: ReaderProfile
) {
  return Buffer.from(
    JSON.stringify(profile),
    "utf8"
  ).toString("base64url");
}

export const readerProfileCookie = {
  name: COOKIE_NAME,
  maxAge: 60 * 60 * 24 * 365,
};
