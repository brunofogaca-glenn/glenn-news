# Glenn News: inventory and refresh policy

This inventory distinguishes editorial article ingestion from the supplemental fact panels on the homepage. Times are local to `Europe/Stockholm`; Vercel cron expressions themselves are UTC.

## Editorial article sources — do not fetch before 06:00

| Source / code | Purpose | Rule |
|---|---|---|
| `lib/rss.ts` / `FEEDS` | RSS feeds for the article pool | Never fetched before 06:00 |
| `lib/webSources.ts` / `WEB_SOURCES` | Extract editorial article links from publisher pages | Never fetched before 06:00 |
| `lib/feedHealth.ts` | Checks the health and freshness of RSS and editorial web sources | Never run before 06:00, because checks perform live requests |
| `lib/dailyEdition.ts` | Builds and persists the morning edition | Explicit guard prevents editorial fetch before 06:00 |
| `app/api/cron/refresh-news/route.ts` | Morning publication and article/feed-health refresh | Existing publication window remains 06:30 while the next delivery moves the initial article refresh to 06:00 |

The homepage, direct feed-health page, and manual refresh action are also gated so they cannot initiate article-feed requests before 06:00. The sports-panel loader no longer imports or calls the editorial article cache.

## Supplemental data sources — refresh from 01:00

| Source / code | Data | Existing cache lifetime | Failure handling |
|---|---|---:|---|
| `lib/sportDay.ts` + `lib/sportDayCache.ts` | Fixtures, results, league table and scorers (API-Football/FotMob; optional Sportmonks enrichment) | 1 hour | Failed refresh reuses last good snapshot when available |
| `lib/marketDay.ts` | Market indices and daily changes (Yahoo Finance) | 24 hours | Empty/failed market response is treated as a failure, not new valid data |
| `lib/dailySnapshots.ts` — local | Borås.com events and Borås Stad meetings | 2 hours | Total upstream failure throws so last good snapshot can be reused |
| `lib/dailySnapshots.ts` — national | Riksdag agenda and news | 1 hour | Total upstream failure throws so last good snapshot can be reused |
| `lib/dailySnapshots.ts` — world | Market indicators, central-bank rates and World Bank GDP | 3 hours | Total upstream failure throws so last good snapshot can be reused |
| `lib/dailySnapshots.ts` — culture | MovieZine release calendar | 4 hours | Fetch failure throws so last good snapshot can be reused |
| `lib/weather.ts` | Borås forecast (Open-Meteo) | 1 hour | Fetch failure throws so last good snapshot can be reused |
| `lib/dailyHeader.ts` | Name day and historical event (Tammergård API/Wikimedia) | 7 days per date key | If both upstreams fail, use last good snapshot |

The supplemental refresh endpoint is `/api/cron/refresh-data`. A GitHub Actions workflow calls it at minutes 03 and 33 each hour; a separate workflow calls `/api/cron/refresh-articles` on the same cadence, the handler skips before 01:00 Stockholm time, runs a source when its hourly refresh is due, and uses the intervening half-hour run for sources marked stale or failed. This external schedule is used because the project deployment reported Vercel Hobby's once-per-day Cron restriction. Configure the GitHub repository variable `GLENN_NEWS_REFRESH_URL` with the production endpoint URL, and configure the same high-entropy `GITHUB_CRON_SECRET` in GitHub repository secrets and the Vercel project environment. The endpoint invalidates and refreshes only the relevant supplemental cache tag. It never calls the editorial article cache or editorial feed-health checker.

## Snapshot persistence

`lib/supplementalCache.ts` stores the most recent successful supplemental result in private Vercel Blob storage. Returned values include refresh metadata: status, last attempt, last success, and whether the snapshot was persisted. Failed upstream calls return the last known good payload when available, rather than replacing it with empty data.

## Operational caveats

- A successful HTTP response can still contain malformed or incomplete content. Source-specific validation should be tightened whenever a provider's response schema is known.
- Market indices reflect the latest completed trading session; a correct closed-market result is not necessarily stale.
- The 06:00 editorial ingestion and the existing 06:30 edition-publication cadence are intentionally separate steps. The next delivery should schedule the first article refresh at 06:00 and ensure publication reuses that verified cache rather than fetching it again.
- Both Vercel cron schedules and GitHub Actions schedule expressions are UTC. The supplemental handler computes gates and refresh metadata in `Europe/Stockholm` to preserve local daylight-saving behavior.
