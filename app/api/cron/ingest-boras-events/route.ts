import { revalidateTag } from "next/cache";
import { authorizeGitHubActionsRefresh } from "@/lib/githubActionsAuth";
import { getCachedLocalSnapshot } from "@/lib/dailySnapshots";
import { getStockholmClock } from "@/lib/updateSchedule";
import { getBrowserScrapedBorasEvents, saveBrowserScrapedBorasEvents, type BrowserScrapedBorasEvent } from "@/lib/borasEventStore";

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
function todayInStockholm(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return (parts.find(p => p.type === "year")?.value ?? "2000") + "-" +
    (parts.find(p => p.type === "month")?.value ?? "01") + "-" +
    (parts.find(p => p.type === "day")?.value ?? "01");
}
function addDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  ret¶»§q«^