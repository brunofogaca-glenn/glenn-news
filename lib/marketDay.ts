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
  source: "Yahoo Finance · historiska stängningar";
};

const INDICES = [
  { symbol: "^OMX", name: "Stockholm" },
  { symbol: "^GDAXI", name: "DAX" },
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "Nasdaq" },
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

async function fetchYahooIndex(
  symbol: string,
  name: string,
  cutoffDate: string
): Promise<MarketIndex & { date: string }> {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

  let lastError: unknown = null;

  for (const host of hosts) {
    try {
      const url = new URL(
        "https://" + host + "/v8/finance/chart/" + encodeURIComponent(symbol)
      );

      url.searchParams.set("range", "10d");
      url.searchParams.set("interval", "1d");
      url.searchParams.set("events", "history");

      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Glenn-News/1.0)",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Yahoo Finance " + symbol + " HTTP " + response.status);
      }

      const payload = (await response.json()) as YahooChart;
      const result = payload.chart?.result?.[0];

      if (!result) {
        throw new Error("Yahoo Finance " + symbol + " returned no chart data");
      }

      const timestamps = result.timestamp ?? [];
      const closes = result.indicators?.quote?.[0]?.close ?? [];
      const exchangeTimeZone = result.meta?.timezone ?? "UTC";

      const rows = timestamps
        .map((timestamp, index) => ({
          timestamp,
          date: formatIndexDate(timestamp, exchangeTimeZone),
          close: closes[index] ?? null,
        }))
        .filter(row => row.close != null && row.date < cutoffDate)
        .sort((a, b) => b.timestamp - a.timestamp);

      const latest = rows[0];
      const previous = rows[1];

      if (!latest || !previous) {
        throw new Error("Yahoo Finance " + symbol + " returned fewer than two completed sessions");
      }

      const latestClose = Number(latest.close);
      const previousClose = Number(previous.close);

      if (!Number.isFinite(latestClose) || !Number.isFinite(previousClose) || previousClose === 0) {
        throw new Error("Yahoo Finance " + symbol + " returned invalid closes");
      }

      return {
        symbol,
        name,
        value: latestClose,
        changePct: ((latestClose / previousClose) - 1) * 100,
        date: latest.date,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Kunde inte hämta " + name);
}

async function getMarketDayInternal(): Promise<MarketDay> {
  const cutoffDate = stockholmDate();
  const successful: Array<MarketIndex & { date: string }> = [];

  // Keep requests sequential: this avoids dropping markets when the public
  // Yahoo endpoint throttles concurrent requests.
  for (const index of INDICES) {
    try {
      successful.push(
        await fetchYahooIndex(index.symbol, index.name, cutoffDate)
      );
    } catch (error) {
      console.error("Marketdata misslyckades för", index.name, error);
    }
  }

  if (successful.length === 0) {
    throw new Error("No market indices could be fetched");
  }

  const date =
    successful
      .map(item => item.date)
      .sort()
      .at(-1) ?? cutoffDate;

  return {
    date,
    indices: successful.map(({ date: _date, ...index }) => index),
    source: "Yahoo Finance · historiska stängningar",
  };
}

const getCachedMarketDayInternal = unstable_cache(
  getMarketDayInternal,
  ["glenn-news-market-day-v4"],
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
