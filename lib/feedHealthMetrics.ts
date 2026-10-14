export const SLOW_RESPONSE_THRESHOLD_MS = 2_500;

type HealthRow = {
  status: string;
  responseMs: number;
};

export function isSlowResponse(responseMs: number) {
  return Number.isFinite(responseMs) && responseMs >= SLOW_RESPONSE_THRESHOLD_MS;
}

export function summarizeResponseTimes(feeds: Array<{ responseMs: number }>) {
  const durations = feeds
    .map(feed => feed.responseMs)
    .filter(value => Number.isFinite(value) && value >= 0)
    .sort((a, b) => a - b);
  const middle = Math.floor(durations.length / 2);
  const medianResponseMs = durations.length === 0
    ? 0
    : durations.length % 2 === 0
      ? Math.round((durations[middle - 1] + durations[middle]) / 2)
      : durations[middle];

  return {
    slow: feeds.filter(feed => isSlowResponse(feed.responseMs)).length,
    slowThresholdMs: SLOW_RESPONSE_THRESHOLD_MS,
    averageResponseMs: durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0,
    medianResponseMs,
  };
}

/** Put actionable problems first; within each status, show slow responders first. */
export function prioritizeHealthFeeds<T extends HealthRow>(feeds: T[]): T[] {
  const priority: Record<string, number> = { error: 0, stale: 1, empty: 2, ok: 3 };
  return [...feeds].sort((a, b) =>
    (priority[a.status] ?? 4) - (priority[b.status] ?? 4) ||
    Number(isSlowResponse(b.responseMs)) - Number(isSlowResponse(a.responseMs)) ||
    b.responseMs - a.responseMs
  );
}
