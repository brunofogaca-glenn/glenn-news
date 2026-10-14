type ReadingSignal = {
  id: number;
  title: string;
  category: string;
  articleType: string;
  source: string;
  topic?: string;
  date: string;
};

type InterestCount = {
  label: string;
  articleCount: number;
};

export type WeeklyInterestProfile = {
  uniqueReadCount: number;
  categories: InterestCount[];
  articleTypes: InterestCount[];
  sources: InterestCount[];
  topics: InterestCount[];
  topTerms: InterestCount[];
};

const STOP_WORDS = new Set([
  "och", "att", "den", "det", "som", "för", "med", "till", "från", "har",
  "om", "på", "av", "i", "en", "ett", "är", "var", "blir", "ska", "kan",
  "men", "inte", "också", "efter", "före", "under", "mot", "kring",
  "the", "and", "that", "this", "with", "from", "have", "has", "into",
  "for", "are", "was", "were", "will", "its", "their", "they", "how",
  "why", "what", "when", "where", "new", "latest", "says", "said",
  "nyhet", "nyheter", "idag", "igår", "senaste", "uppger", "säger",
  "enligt", "innan", "runt", "flera", "därför",
]);

function normalizeLabel(value: string) {
  return value.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tally(values: string[]): InterestCount[] {
  const labels = new Map<string, { label: string; articleCount: number }>();
  for (const raw of values) {
    const label = raw.trim();
    const key = normalizeLabel(label);
    if (!key) continue;
    const current = labels.get(key);
    if (current) current.articleCount += 1;
    else labels.set(key, { label, articleCount: 1 });
  }
  return [...labels.values()]
    .sort((a, b) => b.articleCount - a.articleCount || a.label.localeCompare(b.label, "sv-SE"));
}

/**
 * Turn the last week of unique article opens into explicit, auditable interest signals.
 * Each reading-history item counts at most once for each topic or keyword.
 */
export function buildWeeklyInterestProfile(history: ReadingSignal[]): WeeklyInterestProfile {
  const tokenCounts = new Map<string, { label: string; articleCount: number }>();
  for (const item of history) {
    const combinedText = `${item.title} ${item.topic ?? ""}`.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("sv-SE");
    const tokens = new Set((combinedText.match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter(token => token.length >= 4 && !STOP_WORDS.has(token)));
    for (const token of tokens) {
      const current = tokenCounts.get(token);
      if (current) current.articleCount += 1;
      else tokenCounts.set(token, { label: token, articleCount: 1 });
    }
  }

  return {
    uniqueReadCount: history.length,
    categories: tally(history.map(item => item.category)).slice(0, 8),
    articleTypes: tally(history.map(item => item.articleType)).slice(0, 8),
    sources: tally(history.map(item => item.source)).slice(0, 8),
    topics: tally(history.map(item => item.topic ?? "")).slice(0, 12),
    topTerms: [...tokenCounts.values()]
      .sort((a, b) => b.articleCount - a.articleCount || a.label.localeCompare(b.label, "sv-SE"))
      .slice(0, 18),
  };
}
