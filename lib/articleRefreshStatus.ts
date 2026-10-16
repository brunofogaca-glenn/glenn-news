import { get, put } from "@vercel/blob";

export type ArticleRefreshStatus = {
  dateKey: string;
  status: "ok" | "retry";
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  articleCount: number;
  feedErrors: number;
  staleFeeds: number;
  message?: string;
};

const PREFIX = "glenn-news/article-refresh-status/";

function pathFor(dateKey: string) {
  return PREFIX + dateKey + ".json";
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Read the latest editorial refresh outcome for a Stockholm calendar day. */
export async function getArticleRefreshStatus(dateKey: string): Promise<ArticleRefreshStatus | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !isDateKey(dateKey)) return null;

  try {
    const result = await get(pathFor(dateKey), { access: "private" });
    if (!result?.stream || result.statusCode !== 200) return null;

    const text = await new Response(result.stream).text();
    if (text.length > 8_000) return null;
    const value = JSON.parse(text) as Partial<ArticleRefreshStatus>;

    if (
      value.dateKey !== dateKey ||
      (value.status !== "ok" && value.status !== "retry") ||
      typeof value.lastAttemptAt !== "string" ||
      !(typeof value.lastSuccessAt === "string" || value.lastSuccessAt === null) ||
      typeof value.articleCount !== "number" ||
      typeof value.feedErrors !== "number" ||
      typeof value.staleFeeds !== "number"
    ) {
      return null;
    }

    return value as ArticleRefreshStatus;
  } catch {
    return null;
  }
}

export async function saveArticleRefreshStatus(value: ArticleRefreshStatus): Promise<boolean> {
  if (!process.env.BLOB_READ_WRITE_TOKEN || !isDateKey(value.dateKey)) return false;

  try {
    await put(pathFor(value.dateKey), JSON.stringify(value), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return true;
  } catch (error) {
    console.warn("Kunde inte spara status för artikelhämtning:", error);
    return false;
  }
}
