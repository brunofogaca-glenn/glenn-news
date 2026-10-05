import { unstable_cache } from "next/cache";

export type DailyHeaderInfo = {
  namedays: string[];
  historicalEvent: {
    year: number;
    text: string;
    title?: string;
    link?: string;
  } | null;
};

type NamedayResponse = Array<{
  name?: string;
}>;

type OnThisDayResponse = {
  selected?: Array<{
    year?: number;
    text?: string;
    pages?: Array<{
      titles?: {
        normalized?: string;
      };
      content_urls?: {
        desktop?: {
          page?: string;
        };
      };
    }>;
  }>;
  events?: Array<{
    year?: number;
    text?: string;
    pages?: Array<{
      titles?: {
        normalized?: string;
      };
      content_urls?: {
        desktop?: {
          page?: string;
        };
      };
    }>;
  }>;
};

async function fetchDailyHeader(month: string, day: string): Promise<DailyHeaderInfo> {
  const [namedayResponse, historyResponse] = await Promise.all([
    fetch(
      "https://namnsdag.tammergard.se/api/v1/on/" +
        month +
        "/" +
        day +
        "?countryCode=SE",
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Glenn News/1.0)",
          Accept: "application/json",
        },
      }
    ),
    fetch(
      "https://api.wikimedia.org/feed/v1/wikipedia/sv/onthisday/selected/" +
        month +
        "/" +
        day,
      {
        signal: AbortSignal.timeout(5000),
        headers: {
          "User-Agent": "Glenn News/1.0",
          Accept: "application/json",
        },
      }
    ),
  ]);

  const namedays: string[] = [];

  if (namedayResponse.ok) {
    const data = (await namedayResponse.json()) as NamedayResponse;

    for (const item of data) {
      if (item?.name && !namedays.includes(item.name)) {
        namedays.push(item.name);
      }
    }
  }

  let historicalEvent: DailyHeaderInfo["historicalEvent"] = null;

  if (historyResponse.ok) {
    const data = (await historyResponse.json()) as OnThisDayResponse;
    const candidates = [...(data.selected ?? []), ...(data.events ?? [])];

    const event = candidates.find(
      item => item?.text && typeof item.year === "number"
    );

    if (event?.text && typeof event.year === "number") {
      historicalEvent = {
        year: event.year,
        text: event.text,
        title: event.pages?.[0]?.titles?.normalized,
        link: event.pages?.[0]?.content_urls?.desktop?.page,
      };
    }
  }

  return {
    namedays,
    historicalEvent,
  };
}

export async function getDailyHeaderInfo() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const month = parts.find(part => part.type === "month")?.value ?? "01";
  const day = parts.find(part => part.type === "day")?.value ?? "01";
  const dateKey = month + day;

  return unstable_cache(
    () => fetchDailyHeader(month, day),
    ["glenn-news-daily-header-v1", dateKey],
    {
      revalidate: 7 * 24 * 60 * 60,
      tags: ["glenn-news-daily-header"],
    }
  )();
}
