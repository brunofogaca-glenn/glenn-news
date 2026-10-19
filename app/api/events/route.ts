import { after, NextResponse } from "next/server";
import { recordReaderEvent, type ReaderEvent, type SemanticReaderClassification } from "@/lib/readerProfile";
import { classifyClickedArticle } from "@/lib/articleClassification";

type EventPayload = {
  type?: unknown;
  eventId?: unknown;
  category?: unknown;
  articleType?: unknown;
  source?: unknown;
  topic?: unknown;
  title?: unknown;
  summary?: unknown;
  link?: unknown;
};

function isText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isValidArticleUrl(value: unknown): value is string {
  if (!isText(value, 2_048) || /\s/.test(value)) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

function isValidEventId(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{13}-[a-f0-9]{32}$/i.test(value)) {
    return false;
  }

  const timestamp = Number(value.slice(0, 13));
  const now = Date.now();
  return (
    Number.isFinite(timestamp) &&
    timestamp <= now + 60_000 &&
    timestamp >= now - 10 * 60_000
  );
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 8_192) {
      return NextResponse.json(
        { ok: false, error: "Event payload too large" },
        { status: 413 }
      );
    }

    const body = (await request.json()) as EventPayload;

    if (
      body.type !== "article_click" ||
      !isValidEventId(body.eventId) ||
      !isText(body.category, 80) ||
      !isText(body.articleType, 100) ||
      !isText(body.source, 160) ||
      (body.topic !== undefined && (typeof body.topic !== "string" || body.topic.length > 160)) ||
      (body.title !== undefined && (typeof body.title !== "string" || body.title.length > 300)) ||
      (body.summary !== undefined && (typeof body.summary !== "string" || body.summary.length > 1_500)) ||
      !isValidArticleUrl(body.link)
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid article click event" },
        { status: 400 }
      );
    }

    const event: ReaderEvent = {
      category: body.category.trim(),
      articleType: body.articleType.trim(),
      source: body.source.trim(),
      topic: typeof body.topic === "string" ? body.topic.trim().slice(0, 80) : undefined,
      title: typeof body.title === "string" ? body.title.trim().slice(0, 300) : undefined,
      summary: typeof body.summary === "string" ? body.summary.trim().slice(0, 1_200) : undefined,
      link: body.link,
    };

    // Classify and persist the click together. This puts raw and semantic
    // signals in one Blob object instead of performing two advanced writes.
    // A classifier failure still records the raw click as a single write.
    after(async () => {
      let classification: SemanticReaderClassification | undefined;
      try {
        classification = (await classifyClickedArticle({
          link: body.link as string,
          title: typeof body.title === "string" ? body.title.trim().slice(0, 300) : "",
          summary: typeof body.summary === "string" ? body.summary.trim().slice(0, 1_200) : undefined,
          category: body.category as string,
          articleType: body.articleType as string,
          source: body.source as string,
          topic: typeof body.topic === "string" ? body.topic.trim().slice(0, 80) : undefined,
        })) ?? undefined;
      } catch (error) {
        console.warn("AI article classification skipped; saving raw click only.", error);
      }

      const saved = await recordReaderEvent(event, body.eventId as string, classification);
      if (!saved) {
        console.error("Reader click could not be persisted after the response was sent.");
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reader event failed:", error);

    return NextResponse.json(
      { ok: false, error: "Reader event failed" },
      { status: 500 }
    );
  }
}
