import type { DailyEdition } from "./dailyEdition";

type EditionSection = DailyEdition["sections"][number];
type EditionStory = EditionSection["stories"][number];

export type WeeklyCandidate = {
  id: number;
  title: string;
  description: string;
  source: string;
  category: string;
  link: string;
  image: string | null;
  date: string;
  articleType: string;
  aiSummary: string;
  selectionReason: string;
  newsScore?: number;
  readingScore?: number;
  topic?: string;
  qualityScore?: number;
  isNewswire?: boolean;
};

/** Normalize tracking parameters and URL decoration when comparing articles. */
export function canonicalizeLink(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");

    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key) || /^(fbclid|gclid|dclid|mc_cid|mc_eid|ref_src|campaign)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }

    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\?$/, "");
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

/**
 * Gather selected stories and the wider allArticles pool.
 * Selected stories are visited first, so their richer editorial metadata
 * wins when the same article also appears in full coverage.
 */
export function collectWeeklyCandidates(
  editions: DailyEdition[],
  readLinks: Set<string>
): WeeklyCandidate[] {
  const seen = new Set<string>();
  const candidates: WeeklyCandidate[] = [];

  for (const edition of editions) {
    for (const section of edition.sections ?? []) {
      const sectionStories: EditionStory[] = [
        ...(section.stories ?? []),
        ...(section.allArticles ?? []),
      ];

      for (const story of sectionStories) {
        const link = story.link ?? "";
        const canonical = link ? canonicalizeLink(link) : "";

        if (!link || !canonical || readLinks.has(canonical) || seen.has(canonical)) {
          continue;
        }

        seen.add(canonical);
        candidates.push({
          id: candidates.length,
          title: story.title,
          description: story.description ?? "",
          source: story.source ?? "Okänd källa",
          category: section.key,
          link,
          image: story.image ?? null,
          date: story.date ?? edition.generatedAt,
          articleType: story.articleType,
          aiSummary: story.aiSummary ?? "",
          selectionReason: story.selectionReason ?? "",
          newsScore: story.newsScore,
          readingScore: story.readingScore,
          topic: story.topic,
        });
      }
    }
  }

  return candidates;
}
