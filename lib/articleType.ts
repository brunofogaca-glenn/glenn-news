export const ARTICLE_TYPES = [
  "krönika",
  "analys",
  "intervju",
  "reportage",
  "kommentar",
  "nyhet",
  "notis",
  "guide",
  "recension",
  "övrigt",
] as const;

export type ArticleType = (typeof ARTICLE_TYPES)[number];

export type ArticleTypeInput = {
  title: string;
  description?: string;
  source?: string;
  link?: string;
  articleType?: string;
};

export type ArticleTypeResult = {
  articleType: ArticleType;
  confidence: number;
  method: "metadata" | "title-label" | "url-path" | "text-cue" | "default";
};

const GENERIC_TYPES = new Set<ArticleType>(["nyhet", "notis", "övrigt"]);

const TYPE_ALIASES: Record<string, ArticleType> = {
  column: "krönika",
  columnist: "krönika",
  "opinion piece": "krönika",
  analysis: "analys",
  "deep dive": "analys",
  interview: "intervju",
  feature: "reportage",
  "long read": "reportage",
  editorial: "kommentar",
  "op-ed": "kommentar",
  commentary: "kommentar",
  opinion: "kommentar",
  "leader article": "kommentar",
  "how-to": "guide",
  review: "recension",
  brief: "notis",
  bulletin: "notis",
  news: "nyhet",
  "news story": "nyhet",
};

type TypeRule = {
  type: ArticleType;
  title: RegExp;
  description: RegExp;
};

const TYPE_RULES: TypeRule[] = [
  {
    type: "krönika",
    title: /\b(?:krönika|krönikor|krönikör|kolumn|column|columnist|opinion piece)\b/i,
    description: /\b(?:krönika|krönikor|krönikör|kolumn|columnist|opinion piece)\b/i,
  },
  {
    type: "analys",
    title: /\b(?:analys|analysis|fördjupning|deep dive|explainer)\b/i,
    description: /\b(?:analys|analysen|fördjupning|explainer|deep dive)\b/i,
  },
  {
    type: "intervju",
    title: /\b(?:intervju|intervjuar|frågor och svar|q\s*&\s*a|interview)\b/i,
    description: /\b(?:intervju|intervjuar|frågor och svar|q\s*&\s*a|interview)\b/i,
  },
  {
    type: "reportage",
    title: /\b(?:reportage|feature|long read|på plats|inifrån)\b/i,
    description: /\b(?:reportage|följer med|på plats|inifrån|long read|feature story)\b/i,
  },
  {
    type: "kommentar",
    title: /\b(?:kommentar|ledare|ledartext|debatt|opinion|editorial|op-ed|commentary)\b/i,
    description: /\b(?:kommentar|ledartext|ledare|debattartikel|opinion piece|editorial|commentary)\b/i,
  },
  {
    type: "guide",
    title: /\b(?:guide|så gör du|så fungerar|steg för steg|how to|tips:)\b/i,
    description: /\b(?:guide|steg för steg|checklista|så gör du|så fungerar|how to)\b/i,
  },
  {
    type: "recension",
    title: /\b(?:recension|recenserar|betyg|test:|review|rated)\b/i,
    description: /\b(?:recension|recenserar|recensent|betyg|review|rating)\b/i,
  },
  {
    type: "notis",
    title: /\b(?:notis|i korthet|kortfattat|kort om|news brief|briefing)\b/i,
    description: /\b(?:notis|i korthet|kortfattat|kort om|news brief)\b/i,
  },
];

const TITLE_LABELS: Array<{ type: ArticleType; pattern: RegExp }> = [
  { type: "krönika", pattern: /^\s*[\[(]?\s*(?:krönika|krönikör|kolumn|column|opinion piece)\s*[\])]?[\s:|–—-]+/i },
  { type: "analys", pattern: /^\s*[\[(]?\s*(?:analys|analysis|fördjupning|explainer)\s*[\])]?[\s:|–—-]+/i },
  { type: "intervju", pattern: /^\s*[\[(]?\s*(?:intervju|interview|q\s*&\s*a)\s*[\])]?[\s:|–—-]+/i },
  { type: "reportage", pattern: /^\s*[\[(]?\s*(?:reportage|feature|long read)\s*[\])]?[\s:|–—-]+/i },
  { type: "kommentar", pattern: /^\s*[\[(]?\s*(?:kommentar|ledare|ledartext|debatt|editorial|op-ed)\s*[\])]?[\s:|–—-]+/i },
  { type: "guide", pattern: /^\s*[\[(]?\s*(?:guide|så gör du|how to)\s*[\])]?[\s:|–—-]+/i },
  { type: "recension", pattern: /^\s*[\[(]?\s*(?:recension|review|betyg|test)\s*[\])]?[\s:|–—-]+/i },
  { type: "notis", pattern: /^\s*[\[(]?\s*(?:notis|i korthet|news brief)\s*[\])]?[\s:|–—-]+/i },
];

const URL_PATH_TYPES: Array<{ type: ArticleType; pattern: RegExp }> = [
  { type: "krönika", pattern: /\/(?:kronikor|krönikor|kolumn|columns?)(?:\/|$)/i },
  { type: "analys", pattern: /\/(?:analys|analysis|explainer)(?:\/|$)/i },
  { type: "intervju", pattern: /\/(?:intervju|intervjuer|interview)(?:\/|$)/i },
  { type: "reportage", pattern: /\/(?:reportage|features?|long-read)(?:\/|$)/i },
  { type: "kommentar", pattern: /\/(?:kommentar|ledare|debatt|opinion|editorial)(?:\/|$)/i },
  { type: "guide", pattern: /\/(?:guide|guider|how-to)(?:\/|$)/i },
  { type: "recension", pattern: /\/(?:recension|recensioner|reviews?)(?:\/|$)/i },
];

function normalizeType(value?: string): ArticleType | null {
  const normalized = value?.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
  if (!normalized) return null;

  if ((ARTICLE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as ArticleType;
  }

  return TYPE_ALIASES[normalized] ?? null;
}

function parseUrlPath(value?: string): string {
  if (!value) return "";
  try {
    return new URL(value).pathname.toLocaleLowerCase("sv-SE");
  } catch {
    return "";
  }
}

/**
 * Returns a controlled article type and a rough confidence indicator.
 * Feed-provided specific labels are trusted; generic "nyhet" labels continue
 * through stronger title and URL cues before a title/description-only fallback.
 */
export function classifyArticleType(article: ArticleTypeInput): ArticleTypeResult {
  const supplied = normalizeType(article.articleType);

  if (supplied && !GENERIC_TYPES.has(supplied)) {
    return { articleType: supplied, confidence: 0.99, method: "metadata" };
  }

  const title = (article.title ?? "").trim();
  for (const label of TITLE_LABELS) {
    if (label.pattern.test(title)) {
      return { articleType: label.type, confidence: 0.98, method: "title-label" };
    }
  }

  const urlPath = parseUrlPath(article.link);
  for (const item of URL_PATH_TYPES) {
    if (item.pattern.test(urlPath)) {
      return { articleType: item.type, confidence: 0.9, method: "url-path" };
    }
  }

  const description = article.description ?? "";
  const scores = new Map<ArticleType, number>();

  for (const rule of TYPE_RULES) {
    let score = 0;
    if (rule.title.test(title)) score += 4;
    if (rule.description.test(description)) score += 2.5;
    scores.set(rule.type, score);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const best = ranked[0];
  const second = ranked[1];

  if (best && best[1] >= 2.5) {
    const margin = best[1] - (second?.[1] ?? 0);
    const confidence = Math.max(
      0.52,
      Math.min(0.86, 0.55 + best[1] * 0.045 + Math.max(0, margin) * 0.035)
    );
    return {
      articleType: best[0],
      confidence,
      method: "text-cue",
    };
  }

  // Only retain a generic explicit label after all stronger cues were checked.
  if (supplied) {
    return {
      articleType: supplied,
      confidence: supplied === "nyhet" ? 0.56 : 0.5,
      method: "metadata",
    };
  }

  return { articleType: "nyhet", confidence: 0.42, method: "default" };
}

export function inferArticleType(article: ArticleTypeInput): ArticleType {
  return classifyArticleType(article).articleType;
}
