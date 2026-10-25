import { NextResponse } from "next/server";
import { recordReaderBatch, type BatchedReaderEvent } from "@/lib/readerProfile";
import { classifyClickedArticle } from "@/lib/articleClassification";

export const maxDuration = 60;

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function isArticleUrl(value: unknown): value is string {
  if (!isText(value, 2048) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch { return false; }
}

function isEventId(value: unknown): value is string {
  if (typeof value !== "string" || !/^[0-9]{13}-[a-f0-9]{32}$/i.test(value)) return false;
  const timestamp = Number(value.slice(0, 13));
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 60000 && timestamp >= Date.now() - 86400000;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 180000) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }
    const body = await request.json() as { batchId?: unknown; events?: unknown };
    if (typeof body.batchId !== "string" || !/^[0-9]{13}-[a-f0-9]{32}$/i.test(body.batchId) ||
        !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 50) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const events = body.events as BatchedReaderEvent[];
    for (const event of events) {
      if (!event || !isEventId(event.eventId) || typeof event.timestamp !== "string" ||
          !Number.isFinite(Date.parse(event.timestamp)) || Date.parse(event.timestamp) > Date.now() + 60000 ||
          Date.parse(event.timestamp) < Date.now() - 86400000 ||
          !isText(event.category, 80) || !isText(event.articleType, 100) ||
          !isText(event.source, 160) || !isArticleUrl(event.link) ||
          (event.topic !== undefined && (typeof event.topic !== "string" || event.topic.length > 160)) ||
          (event.title !== undefined && (typeof event.title !== "string" || event.title.length > 300)) ||
          (event.summary !== undefined && (typeof event.summary !== "string" || event.summary.length > 1500))) {
        return NextResponse.json({ ok: false }, { status: 400 });
      }
    }
    const classified = await Promise.all(events.map(async event => {
      try {
        const classification = await classifyClickedArticle({
          link: event.link ?? "", title: event.title ?? "", summary: event.summary,
          category: event.category, articleType: event.articleType, source: event.source, topic: event.topic,
        });
        return { ...event, classification: classification ?? null };
      } catch {
        return { ...event, classification: null };
      }
    }));
    const saved = await recordReaderBatch(body.batchId, classified);
    return saved
      ? NextResponse.json({ ok: true, saved: classified.length })
      : NextResponse.json({ ok: false }, { status: 503 });
  } catch (error) {
    console.error("Reader batch failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
