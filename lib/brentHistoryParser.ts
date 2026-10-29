const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

function cellText(value: string) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: string) {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];

  const human = value.match(
    /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})\b/i
  );
  if (!human) return null;
  return human[3] + "-" + MONTHS[human[1].toLowerCase()] + "-" + String(Number(human[2])).padStart(2, "0");
}

function parseNumber(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/,/g, "");
  const parsed = Number(normalized);
  return normalized && Number.isFinite(parsed) ? parsed : null;
}

export type ParsedBrentClose = {
  date: string;
  value: number;
  changePct?: number;
};

/**
 * Parse the public FT historical table into completed daily Brent closes.
 * The cutoff is a Stockholm-local YYYY-MM-DD key; today's incomplete row is
 * intentionally excluded. Return null when the page schema changes instead
 * of inventing a number.
 */
export function parseFtBrentHistory(html: string, cutoffDate: string): ParsedBrentClose | null {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const observations: Array<{ date: string; close: number }> = [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map(match => cellText(match[1]));
    if (cells.length < 5) continue;

    const date = parseDate(cells[0]);
    if (!date || date >= cutoffDate) continue;

    // Historical columns are Date, Open, High, Low, Close, Volume.
    const close = parseNumber(cells[4]);
    if (close === null || close <= 0) continue;
    observations.push({ date, close });
  }

  observations.sort((a, b) => b.date.localeCompare(a.date));
  const latest = observations[0];
  if (!latest) return null;

  const previous = observations[1];
  return {
    date: latest.date,
    value: latest.close,
    changePct: previous && previous.close !== 0
      ? (latest.close / previous.close - 1) * 100
      : undefined,
  };
}
