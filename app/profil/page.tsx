import {
  getReaderProfile,
  getRecentReaderActivity,
} from "@/lib/readerProfile";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  elfsborg: "Elfsborg",
  boras: "Lokalt",
  sverige: "Sverige",
  varlden: "V채rlden",
  ekonomi: "Ekonomi",
  sport: "Sport",
  livsstil: "Kultur, Mat & Livsstil",
  fotboll: "Fotboll",
};

const SEMANTIC_CATEGORY_LABELS: Record<string, string> = {
  politics: "Politik",
  economy: "Ekonomi",
  society: "Samh채lle",
  world: "V채rlden",
  local: "Lokalt",
  sport: "Sport",
  culture: "Kultur",
  technology: "Teknik",
  health: "H채lsa",
  climate: "Klimat",
  travel: "Resor",
  lifestyle: "Livsstil",
  other: "횜vrigt",
};

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, char => char.toUpperCase());
}

const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";

function stockholmParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(value);

  return Object.fromEntries(
    parts
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );
}

function stockholmDateKey(value: Date) {
  const parts = stockholmParts(value);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function shiftDateKey(dateKey: string, days: number) {
떻쬺�^