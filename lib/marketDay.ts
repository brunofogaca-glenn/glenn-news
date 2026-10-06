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
  error?: string;
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

type YahooSparkResult = {
  symbol?: string;
  response?: Array<{
    timestamp?: number[];
    indicators?: {
      quote?: Array<{
        close?: Array<number | null>;
      }>;
    };
    meta?: {
      timezone?: string;
    };
  }>;
};

async function fetchAllYahooIndices(cutoffDate: string) {
  const symbols = INDICES.map(index => index.symbol).join(",");
  const url = new URL("https://query1.finance.yahoo.com/v7/finance/spark");
  url.searchParams.set("symbols", symbols);
  url.searchParams.set("range", "1mo");
  url.searchParams.set("interval", "1d");

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Glenn-News/1.0)",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Yahoo Finance spark HTTP " + response.status);
  }

  const payload = (await response.json()) as {
    spark?: { result?: YahooSparkResult[] };
  };
  const result = payload.spark?.result ?? [];

  if (!result.length) {
    throw new Error("Yahoo Finance spark returned no data");
  }

  const markets: Array<MarketIndex & { date: string }> = [];

  for (const index of INDICES) {
    const item = result.find(resultItem => resultItem.symbol === index.symbol);
    const responseData = item?.response?.[0];

    if (!responseData) {
      console.error("Yahoo Finance saknar", index.name);
      continue;
    }

    const timestamps = responseData.timestamp ?? [];
    const closes = responseData.indicators?.quote?.[0]?.close ?? [];
    const exchangeTimeZone = responseData.meta?.timezone ?? "UTC";

    const rows = timestamps
      .map((timestamp, position) => ({
        timestamp,
        date: formatIndexDate(timestamp, exchangeTimeZone),
        close: closes[position] ?? null,
      }))
      .filter(row =>
        row.close != null &&
        row.date < cutoffDate &&
        Number.isFinite(Number(row.close))
      )
      .sort((a, b) => b.timestamp - a.timestamp);

    const latest = rows[0];
    const previous = rows[1];

    if (!latest || !previous) {
      console.error("Yahoo Finance saknar två färdiga handelsdagar för", index.name);
      continue;
    }

    const latestClose = Number(latest.close);
    const previousClose = Number(previous.close);

    if (!Number.isFinite(latestClose) || !Number.isFinite(previousClose) || previousClose === 0) {
      continue;
    }

    markets.push({
      symbol: index.symbol,
      name: index.name,
      value: latestClose,
      changePct: ((latestClose / previousClose) - 1) * 100,
      date: latest.date,
    });
  }

  return markets;
}

async function getMarketDayInternal(): Promise<MarketDay> {
  const cutoffDate = stockholmDate();

  try {
    const indices = await fetchAllYahooIndices(cutoffDate);

    if (!indices.length) {
      return {
        date: cutoffDate,
        indices: [],
        source: "Yahoo Finance · historiska stängningar",
        error: "Yahoo Finance returnerade ingen användbar marknadsdata.",
      };
    }

    const date =
      indices
        .map(index => index.date)
        .sort()
        .at(-1) ?? cutoffDate;

    return {
      date,
      indices: indices.map(({ date: _date, ...index }) => index),
      source: "Yahoo Finance · historiska stängningar",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Okänt fel från marknadskällan.";

    console.error("Marketdata misslyckades:", message);

    return {
      date: cutoffDate,
      indices: [],
      source: "Yahoo Finance · historiska stängningar",
      error: message,
    };
  }
}

const getCachedMarketDayInternal = unstable_cache(
  getMarketDayInternal,
  ["glenn-news-market-day-v6"],
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
