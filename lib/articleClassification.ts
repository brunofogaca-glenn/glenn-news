import OpenAI from "openai";
import { createHash } from "node:crypto";
import { get, put } from "@vercel/blob";
import { normalizeArticleUrl } from "./articleUrl";

const CLASSIFICATION_PREFIX = "glenn-news/article-classifications/v1/";
const CLASSIFICATION_VERSION = 1;
const MODEL = "gpt-5-mini";
const AI_TIMEOUT_MS = 6_500;
const MAX_INPUT_LENGTH = 1_500;

const BROAD_CATEGORIES = [
  "sport", "politics", "economy", "society", "world", "local", "culture",
  "technology", "health", "climate", "travel", "lifestyle", "other",
] as const;
const ARTICLE_TYPES = [
  "krönika", "analys", "intervju", "reportage", "kommentar", "nyhet",
  "notis", "guide", "recension", "övrigt",
] as const;
const ENTITY_KINDS = [
  "person", "team", "organization", "place", "league", "company", "event", "other",
] as const;

type BroadCategory = (typeof BROAD_CATEGORIES)[number];
type ArticleType = (typeof ARTICLE_TYPES)[number];
type EntityKind = (typeof ENTITY_KINDS)[number];

export type ArticleClassificationInput = {
  link: string;
  title: string;
  summary?: string;
  category: string;
  articleType: string;
  source: string;
  topic?: string;
};

export type ArticleClassification = {
  version: 1;
  urlHash: string;
  title: string;
  broadCategory: BroadCategory;
  mainTopic: string;
  tags: string[];
  entities: Array<{ name: string; kind: EntityKind }>;
  geography: {
    country: string | null;
    region: string | null;
    city: string | null;
  };
  articleType: ArticleType;
  eventKey: string;
  confidence: number;
  model: string;
  classifiedAt: string;
};

let openaiClient: OpenAI | null = null;
const inFlight = new Map<string, Promise<ArticleClassification | null>>();

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: AI_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return openaiClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown, maxLength = 100): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeConcept(value: unknown, maxLength = 80): string {
  return textValue(value, maxLength).toLocaleLowerCase("sv-SE");
}

function fallbackCategory(section: string): BroadCategory {
  const key = section.trim().toLowerCase();
  if (key === "sport" || key === "elfsborg") return "sport";
  if (key === "boras") return "local";
  if (key === "sverige") return "society";
  if (key === "varlden") return "world";
  if (key === "ekonomi") return "economy";
  if (key === "livsstil") return "culture";
  return "other";
}

function fallbackArticleType(value: string): ArticleType {
  const key = value.trim().toLocaleLowerCase("sv-SE");
  return (ARTICLE_TYPES as readonly string[]).includes(key)
    ? key as ArticleType
    : "övrigt";
}

function urlHashFor(link: string) {
  const normalized = normalizeArticleUrl(link);
  return normalized
    ? createHash("sha256").update(normalized).digest("hex")
    : "";
}

function classificationPath(urlHash: string) {
  return CLASSIFICATION_PREFIX + urlHash + ".json";
}

function cleanTags(value: unknown, fallbackTopic: string): string[] {
  const candidates = Array.isArray(value) ? value : [];
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const tag = normalizeConcept(candidate, 70);
    if (tag.length < 2 || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 10) break;
  }

  const fallback = normalizeConcept(fallbackTopic, 70);
  if (tags.length === 0 && fallback.length >= 2) tags.push(fallback);
  return tags;
}

function cleanEntities(value: unknown): Array<{ name: string; kind: EntityKind }> {
  if (!Array.isArray(value)) return [];
  const entities: Array<{ name: string; kind: EntityKind }> = [];
  const seen = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const name = textValue(candidate.name, 90);
    if (name.length < 2) continue;
    const rawKind = typeof candidate.kind === "string" ? candidate.kind : "";
    const kind: EntityKind = (ENTITY_KINDS as readonly string[]).includes(rawKind)
      ? rawKind as EntityKind
      : "other";
    const key = name.toLocaleLowerCase("sv-SE") + ":" + kind;
    if (seen.has(key)) continue;
    seen.add(key);
    entities.push({ name, kind });
    if (entities.length >= 10) break;
  }

  return entities;
}

function parseClassification(
  value: unknown,
  input: ArticleClassificationInput,
  urlHash: string
): ArticleClassification | null {
  if (!isRecord(value)) return null;
  if (
    value.version !== CLASSIFICATION_VERSION ||
    value.urlHash !== urlHash ||
    typeof value.classifiedAt !== "string" ||
    typeof value.broadCategory !== "string" ||
    typeof value.mainTopic !== "string" ||
    typeof value.articleType !== "string"
  ) {
    return null;
  }

  const broadCategory: BroadCategory =
    (BROAD_CATEGORIES as readonly string[]).includes(value.broadCategory)
      ? value.broadCategory as BroadCategory
      : fallbackCategory(input.category);
  const articleType: ArticleType =
    (ARTICLE_TYPES as readonly string[]).includes(value.articleType)
      ? value.articleType as ArticleType
      : fallbackArticleType(input.articleType);
  const storedTitle = textValue(value.title, 300);
  const mainTopic = normalizeConcept(value.mainTopic, 90) ||
    normalizeConcept(input.topic, 90) ||
    broadCategory;
  const rawGeo = isRecord(value.geography) ? value.geography : {};
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence)
    ? Math.max(0, Math.min(1, value.confidence))
    : 0.5;

  return {
    version: 1,
    urlHash,
    title: storedTitle || textValue(input.title, 300),
    broadCategory,
    mainTopic,
    tags: cleanTags(value.tags, mainTopic),
    entities: cleanEntities(value.entities),
    geography: {
      country: textValue(rawGeo.country, 80) || null,
      region: textValue(rawGeo.region, 80) || null,
      city: textValue(rawGeo.city, 80) || null,
    },
    articleType,
    eventKey: normalizeConcept(value.eventKey, 120) || mainTopic,
    confidence,
    model: MODEL,
    classifiedAt: textValue(value.classifiedAt, 40) || new Date().toISOString(),
  };
}

async function readStoredClassification(
  input: ArticleClassificationInput,
  urlHash: string
): Promise<ArticleClassification | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const result = await get(classificationPath(urlHash), { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;

    const text = await new Response(result.stream).text();
    if (text.length > 24_000) return null;

    return parseClassification(JSON.parse(text), input, urlHash);
  } catch {
    return null;
  }
}

/** Read an already classified article without triggering another AI request. */
export async function getArticleClassificationForUrl(
  link: string
): Promise<ArticleClassification | null> {
  const urlHash = urlHashFor(link);
  if (!urlHash) return null;
  return readStoredClassification({
    link,
    title: "",
    category: "other",
    articleType: "övrigt",
    source: "",
  }, urlHash);
}

/**
 * Classify a clicked article once and keep its structured labels in private
 * Blob storage. Click history is never sent to the model; only article metadata
 * is sent, and stored results are reused for URL variants without tracking tags.
 */
export async function classifyClickedArticle(
  input: ArticleClassificationInput
): Promise<ArticleClassification | null> {
  const title = textValue(input.title, 300);
  const normalizedUrl = normalizeArticleUrl(input.link);
  if (!title || !normalizedUrl) return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.OPENAI_API_KEY) return null;

  const urlHash = urlHashFor(input.link);
  if (!urlHash) return null;

  const existing = await readStoredClassification({ ...input, title }, urlHash);
  if (existing) return existing;

  const pending = inFlight.get(urlHash);
  if (pending) return pending;

  const task = createAndStoreClassification({ ...input, title }, urlHash);
  inFlight.set(urlHash, task);
  try {
    return await task;
  } finally {
    inFlight.delete(urlHash);
  }
}

async function createAndStoreClassification(
  input: ArticleClassificationInput,
  urlHash: string
): Promise<ArticleClassification | null> {
  try {
    const response = await getOpenAIClient().responses.create({
      model: MODEL,
      input: `
Du är en strukturerad artikelklassificerare för en personlig nyhetsläsare.
Klassificera ENBART artikeln; använd aldrig information om läsarens klickhistorik.
Utgå från rubrik, sammanfattning och metadata. Hitta inte på personer, händelser
eller platser. Om geografi eller entiteter inte framgår ska de utelämnas.

Returnera endast ett JSON-objekt med dessa fält:
{
  "broadCategory": "sport|politics|economy|society|world|local|culture|technology|health|climate|travel|lifestyle|other",
  "mainTopic": "kort, återanvändbart ämnesnamn",
  "tags": ["2–8 korta, generella ämnesetiketter"],
  "entities": [{"name":"namn","kind":"person|team|organization|place|league|company|event|other"}],
  "geography": {"country":"land eller null","region":"region eller null","city":"stad eller null"},
  "articleType": "krönika|analys|intervju|reportage|kommentar|nyhet|notis|guide|recension|övrigt",
  "eventKey": "kort kanonisk etikett för den konkreta nyhetshändelsen, eller mainTopic om ingen specifik händelse finns",
  "confidence": 0.0
}

Regler:
- broadCategory är en bred och stabil kategori; skilj exempelvis sport från lokala nyheter.
- tags ska beskriva innehållet så att olika publicisters artiklar kan jämföras.
- mainTopic ska vara ett meningsfullt ämnesspår, inte en hel mening.
- eventKey ska vara samma typ av kort etikett för artiklar som handlar om samma händelse.
- entity-kind måste vara ett av de angivna alternativen.
- confidence är ett tal mellan 0 och 1.
- Bevara riktiga namn korrekt. Skriv naturlig svenska för etiketter.
- Om underlaget är tunt, ange lägre confidence i stället för att gissa.

ARTIKELMETADATA:
${JSON.stringify({
        title: input.title,
        summary: textValue(input.summary, MAX_INPUT_LENGTH),
        section: textValue(input.category, 80),
        suppliedArticleType: textValue(input.articleType, 80),
        source: textValue(input.source, 120),
        existingTopic: textValue(input.topic, 90),
      })}
`,
    });

    const output = response.output_text?.trim();
    if (!output) return null;

    // Enrich the model payload with trusted storage metadata before validation.
    const modelOutput = JSON.parse(output);
    const parsed = parseClassification({
      ...(isRecord(modelOutput) ? modelOutput : {}),
      version: CLASSIFICATION_VERSION,
      urlHash,
      title: input.title,
      classifiedAt: new Date().toISOString(),
      model: MODEL,
    }, input, urlHash);
    if (!parsed) return null;

    await put(
      classificationPath(urlHash),
      JSON.stringify(parsed),
      {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
      }
    );

    return parsed;
  } catch (error) {
    console.warn("Article AI classification failed; click tracking remains saved.", error);
    return null;
  }
}
