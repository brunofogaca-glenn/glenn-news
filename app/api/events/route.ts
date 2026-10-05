import { NextResponse } from "next/server";
import {
  getReaderProfile,
  updateReaderProfile,
  serializeReaderProfile,
  readerProfileCookie,
} from "@/lib/readerProfile";

type EventPayload = {
  type?: string;
  category?: string;
  articleType?: string;
  source?: string;
  topic?: string;
};

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as EventPayload;

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

    const current =
      await getReaderProfile();

    const next =
      updateReaderProfile(
        current,
        {
          category: body.category,
          articleType: body.articleType,
          source: body.source,
          topic: body.topic,
        }
      );

    const response = NextResponse.json({
      ok: true,
      totalClicks: next.totalClicks,
    });

    response.cookies.set({
      name: readerProfileCookie.name,
      value: serializeReaderProfile(next),
      maxAge: readerProfileCookie.maxAge,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
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
