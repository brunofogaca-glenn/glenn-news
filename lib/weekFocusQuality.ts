import { inferArticleType } from "./articleType";
import type { WeeklyCandidate } from "./weekFocusCandidates";

const GENERIC_TYPES = new Set(["nyhet", "övrigt", "notis"]);
const TITLE_STOP_WORDS = new Set([
  "och", "att", "den", "det", "som", "för", "med", "till", "från", "har", "om", "på", "av",
  "en", "ett", "är", "var", "nu", "där", "här", "när", "hur", "kan", "ska", "uppger", "säger",
  "enligt", "idag", "igår", "senaste", "nyheter", "nyhet", "direkt", "uppdaterad", "live",
  "the", "and", "for", "with", "from", "says", "said", "after", "what", "how", "why",
]);
const NEWSWIRE_SOURCE = /(?:^|\b)(?:tt(?:\s+nyhetsbyr[aå]n)?|reuters|associated\s+press|ap\s+news|afp|agence\s+france-presse|dpa|ntb|ritzau|press\s+association|newswire|nyhetsbyr[aå]n\s+direkt)(?:\b|$)/i;
const WIRE_TITLE = /^(?:tt|reuters|ap|afp|ntb|dpa)\s*[-:|]/i;

export type QualityWeeklyCandidate = WeeklyCandidate & {
  qualityScore: number;
  isNewswire: boolean;
};

export function isNewswireCandidate(article: Pick<WeeklyCandidate, "title"> & { source?: string }): boolean {
  return NEWSWIRE_SOURCE.test(article.source ?? "") || WIRE_TITLE.test(article.title ?? "");
}

function normalizedTitleTokens(title: string): string[] {
  const normalized = title.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE");
  return [...new Set((normalized.match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(token => token.length > 2 && !TITLE_STOP_WORDS.has(token)))];
}

function titleSimilarity(left: string, right: string): number {
  const a = normalizedTitleTokens(left);
  const b = normalizedTitleTokens(right);
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const overlap = a.filter(token => setB.has(token)).length;
  if (overlap < 4) return 0;
  return overlap / new Set([...a, ...b]).size;
}

export function scoreWeeklyReadingQuality(article: WeeklyCandidate): number {
  const articleType = inferArticleType(article);
  const descriptionLength = (article.description ?? "").trim().length;
  const text = `${article.title} ${article.description ?? ""}`.toLocaleLowerCase("sv-SE");
  let score = 0;

  if (articleType === "krönika") score += 60;
  else if (articleType === "analys") score += 56;
  else if (articleType === "intervju") score += 52;
  else if (articleType === "reportage") score += 50;
  else if (articleType === "kommentar") score += 46;
  else if (articleType === "recension") score += 40;
  else if (articleType === "guide") score += 28;
  else if (articleType === "notis") score -= 22;
  else if (GENERIC_TYPES.has(articleType)) score += 4;

  if (descriptionLength >= 600) score += 14;
  else if (descriptionLength >= 350) score += 10;
  else if (descriptionLength >= 180) score += 6;
  else if (descriptionLength < 70) score -= 6;

  if (/direktrapport|minut för minut|löpande rapportering|senaste nytt/.test(text)) score -= 14;
  if (article.aiSummary?.trim()) score += 3;
  if (isNewswireCandidate(article)) score -= 18;

  return score;
}

/** Normalize article types, score likely reading depth, and collapse strong title near-duplicates. */
export function curateWeeklyCandidates(candidates: WeeklyCandidate[]): QualityWeeklyCandidate[] {
  const prepared = candidates.map(article => ({
    ...article,
    articleType: inferArticleType(article),
    isNewswire: isNewswireCandidate(article),
    qualityScore: scoreWeeklyReadingQuality(article),
  })).sort((a, b) =>
    b.qualityScore - a.qualityScore ||
    (b.newsScore ?? 0) - (a.newsScore ?? 0) ||
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const selected: QualityWeeklyCandidate[] = [];
  const seenTitleKeys = new Set<string>();

  for (const article of prepared) {
    const normalized = normalizedTitleTokens(article.title).sort().join(" ");
    if (normalized && seenTitleKeys.has(normalized)) continue;
    if (selected.some(existing => titleSimilarity(existing.title, article.title) >= 0.68)) continue;
    if (normalized) seenTitleKeys.add(normalized);
    selected.push(article);
  }

  return selected.map((article, id) => ({ ...article, id }));
}
