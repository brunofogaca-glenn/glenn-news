import { NextResponse } from "next/server";
import { recordReaderBatch, type BatchedReaderEvent } from "@/lib/readerProfile";
import { classifyClickedArticle } from "@/lib/articleClassification";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json() as { batchId?: unknown; events?: unknown };
    if (typeof body.batchId !== "string" || !/^[0-9]{13}-[a-f0-9]{32}$/i.test(body.batchId) ||
        !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 50) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    const events = body.events as BatchedReaderEvent[];
    for (const event of events) {
      if (!event || typeof event.eventId !== "string" || typeof event.timestamp !== "string" ||
          !event.category || !event.articleType || !event.source || typeof event.link !== "string") {
        return NextResponse.json({ ok: false }, { status: 400 });
      }
      const stamp = Date.parse(event.timestamp);
      if (!Number.isFinite(stamp) || stamp > Date.now() + 60000 || stamp < Date.now() - 86400000) {
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
