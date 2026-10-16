const TIME_ZONE = "Europe/Stockholm";

export function getStockholmClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return {
    hour: Number(parts.find(part => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find(part => part.type === "minute")?.value ?? "0"),
  };
}

/** News articles and editorial RSS sources must not be fetched before 06:00 Stockholm time. */
export function canRefreshEditorialSourcesNow(date = new Date()) {
  return getStockholmClock(date).hour >= 6;
}
