import { NextResponse } from "next/server";
import { recordReaderEvent } from "@/lib/readerProfile";

type EventPayload = {
  type?: string;
  category?: string;
  articleType?: string;
  source?: string;
  topic?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EventPayload;

    if (
      body.type !== "article_click" ||
      !body.category ||
      !body.articleType ||
      !body.source
    ) {
      return NextResponse.json(
        { ok: false },
        { status: 400 }
      );
    }

    const saved = await recordReaderEvent({
      category: body.category,
      articleType: body.articleType,
      source: body.source,
      topic: body.topic,
    });

    return NextResponse.json({
      ok: saved,
    });
  } catch (error) {
    console.error(
      "Reader event failed:",
      error
    );

    return NextResponse.json(
      { ok: false },
      { status: 500 }
    );
  }
}
