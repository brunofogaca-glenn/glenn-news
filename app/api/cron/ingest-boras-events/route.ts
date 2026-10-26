import { revalidateTag } from "next/cache";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import { getStockholmClock } from "@/lib/updateSchedule";
import { saveBrowserScrapedBorasEvents, type BrowserScrapedBorasEvent } from "@/lib/borasEventStore";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function validText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}
function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function todayInStockholm() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return (parts.find(p => p.type === "year")?.value ?? "2000") + "-" +
    (parts.find(p => p.type === "month")?.value ?? "01") + "-" +
    (parts.find(p => p.type === "day")?.value ?? "01");
}
function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
function safeImage(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch { return undefined; }
}

export async function POST(request: Request) {
  if (!(await authorizeGitHubActionsRefresh(request, "borasEvents"))) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const clock = getStockholmClock();
  if (clock.hour >= 6) {
    return Response.json({ ok: true, skipped: true, reason: "Nightly write window closed at 06:00 Europe/Stockholm" });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 1_500_000) {
    return Response.json({ ok: false, error: "Scraped event payload too large" }, { status: 413 });
  }

  let payload: { events?: unknown };
  try { payload = await request.json() as { events?: unknown }; }
  catch { return Response.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 }); }

  if (!Array.isArray(payload.events) || payload.events.length < 6 || payload.events.length > 500) {
    return Response.json({ ok: false, error: "Expected between 6 and 500 Borås events" }, { status: 422 });
  }

  const today = todayInStockholm();
  const cutoff = addDays(today, 60);
  const unique = new Map<string, BrowserScrapedBorasEvent>();

  for (const raw of payload.events) {
    if (!isRecord(raw) || !validText(raw.title, 260) || !validText(raw.url, 2_048) || !isDate(raw.date)) continue;
    let url: URL;
    try { url = new URL(raw.url); } catch { continue; }
    if (url.protocol !== "https:" || !["www.boras.com", "boras.com"].includes(url.hostname.toLowerCase()) ||
        !/^\/evenemang\/[^/?#]+\/?$/.test(url.pathname)) continue;
    const endDate = isDate(raw.endDate) ? raw.endDate : undefined;
    if (raw.date > cutoff || (endDate ?? raw.date) < today) continue;

    const item: BrowserScrapedBorasEvent = {
      title: raw.title.trim().slice(0, 260),
      url: url.toString(),
      date: raw.date,
      endDate,
      time: typeof raw.time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw.time) ? raw.time : undefined,
      venue: validText(raw.venue, 160) ? raw.venue.trim().slice(0, 160) : undefined,
      description: typeof raw.description === "string" ? raw.description.trim().slice(0, 700) || undefined : undefined,
      image: safeImage(raw.image),
    };
    unique.set(item.url, item);
  }

  const events = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date) ||
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  if (events.length < 6) {
    return Response.json({ ok: false, error: "Färre än sex kommande Borås-evenemang efter validering; den sparade kalendern lämnades orörd." }, { status: 422 });
  }

  try {
    const snapshot = await saveBrowserScrapedBorasEvents(events);
    revalidateTag("glenn-news-daily-local", { expire: 0 });
    return Response.json({ ok: true, stored: snapshot.events.length, savedAt: snapshot.savedAt, source: snapshot.sourceUrl });
  } catch (error) {
    console.error("Borås browser scrape could not be saved:", error);
    return Response.json({ ok: false, error: "Kunde inte spara Borås-evenemangen." }, { status: 500 });
  }
}
