import { unstable_cache } from "next/cache";

const TIME_ZONE = "Europe/Stockholm";

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      meta?: { timezone?: string };
    }>;
  };
};

export type MarketIndex = {
  symbol: string;
  name: string;
  value: number;
  changePct: number;
};

export type MarketDay = {
  date: string;
  indices: MarketIndex[];
  source: "Yahoo Finance";
};

const INDICES = [
  { symbol: "^OMX", name: "OMX Stockholm 30" },
  { symbol: "^GDAXI", name: "DAX" },
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "Nasdaq" },
  { symbol: "^N225", name: "Nikkei 225" },
] as const;

function stockholmDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find(part => part.type === "year")?.value ?? "0000";
  const month = parts.find(part => part.type === "month")?.value ?? "00";
  const day = parts.find(part => part.type === "day")?.value ?? "00";

  return year + "-" + month + "-" + day;
}

function formatIndexDate(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp * 1000));
}

async function fetchIndex(symbol: string, name: string, cutoffDate: string): Promise<MarketIndex & { date: string }> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", "10d");
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");

  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Glenn-News/1.0)" },
    cache: "no-store",
  });

  if (!response.ok) throw new Error(`Yahoo Finance ${symbol}: HTTP ${response.status}`);

  const payload = (await response.json()) as YahooChart;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const timeZone = result?.meta?.timezone ?? "UTC";

  const rows = timestamps
    .map((timestamp, index) => ({
      timestamp,
      date: formatIndexDate(timestamp, timeZone),
      close: closes[index] ?? null,
    }))
    .filter(row => row.close != null && row.date < cutoffDate)
    .sort((a, b) => b.timestamp - a.timestamp);

  const latest = rows[0];
  const previous = rows[1];

  if (!latest || !previous) {
    throw new Error(`No completed market history for ${symbol}`);
  }

  return {
    symbol,
    name,
    value: latest.close as number,
    changePct: ((latest.close as number) / (previous.close as number) - 1) * 100,
    date: latest.date,
  };
}

async function getMarketDayInternal(): Promise<MarketDay> {
  const cutoffDate = stockholmDate();
  const results = await Promise.allSettled(
    INDICES.map(index => fetchIndex(index.symbol, index.name, cutoffDate))
  );

  const successful = results
    .filter((result): result is PromiseFulfilledResult<MarketIndex & { date: string }> => result.status === "fulfilled")
    .map(result => result.value);

  if (successful.length === 0) {
    throw new Error("No market indices could be fetched");
  }

  const dates = successful.map(item => item.date);
  const date = dates.sort().at(-1) ?? stockholmDate();

  return {
    date,
    indices: successful.map(({ date: _date, ...index }) => index),
    source: "Yahoo Finance",
  };
}

const getCachedMarketDayInternal = unstable_cache(
  getMarketDayInternal,
  ["glenn-news-market-day-v2"],
  {
    revalidate: 24 * 60 * 60,
    tags: ["glenn-news-market-day"],
  }
);

export async function getCachedMarketDay() {
  return getCachedMarketDayInternal();
}

export async function refreshMarketDay() {
  return getCachedMarketDayInternal();
}
