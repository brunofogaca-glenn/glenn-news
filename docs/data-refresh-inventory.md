# Glenn News: inventory and refresh policy

This inventory distinguishes editorial article ingestion from the supplemental fact panels on the homepage. Times are local to `Europe/Stockholm`; Vercel cron expressions themselves are UTC.

## Editorial article sources — do not fetch before 06:00

| Source / code | Purpose | Rule |
|---|---|---|
| `lib/rss.ts` / `FEEDS` | RSS feeds for the article pool | Never fetched before 06:00 |
| `lib/webSources.ts` / `WEB_SOURCES` | Extract editorial article links from publisher pages | Never fetched before 06:00 |
| `lib/feedHealth.ts` | Checks the health and freshness of RSS and editorial web sources | Never run before 06:00, because checks perform live requests |
| `lib/dailyEdition.ts` | Builds and persists the morning edition | Explicit guard prevents editorial fetch before 06:00 |
| `app/api/cron/refresh-articles/route.ts` | Warms the article cache and checks feed health | GitHub Actions calls it at minutes 03 and 33; first eligible run is after 06:00. After success it refreshes hourly; after a substantial failure it retries every 30 minutes |
| `app/api/cron/refresh-news/route.ts` | Publishes the morning edition | Existing publication/retry window remains around 06:30; it performs a final editorial refresh before edition generation |

The homepage, direct feed-health page, and manual refresh action are also gated so they cannot initiate article-feed requests before 06:00. The sports-panel loader no longer imports or calls the editorial article cache.

## Supplemental data sources — refresh from 01:00

| Source / code | Data | Existing cache lifetime | Failure handling |
|---|---|---:|---|
| `lib/sportDay.ts` + `lib/sportDayCache.ts` | Fixtures, results, league table and scorers (API-Football/FotMob; optional Sportmonks enrichment) | 1 hour | Failed refresh reuses last good snapshot when available |
| `lib/marketDay.ts` | Market indices and daily changes (Yahoo Finance) | 24 hours | Empty/failed market response is treated as a failure, not new valid data |
| `lib/dailySnapshots.ts` — local | Borås.com events and Borås Stad meetings | 2 hours | Total upstream failure throws so last good snapshot can be reused |
| `lib/dailySnapshots.ts` — national | Riksdag agenda and news | 1 hour | Total upstream failure throws so last good snapshot can be reused |
| `lib/dailySnapshots.ts` — world | Market indicators, central-bank rates and World Bank GDP | 3 hours | Total upstream failure throws so last good snapshot can be reused |
| `lib/dailySnapshots.ts` — culture | DN film and album review RSS feeds | 4 hours | Fetch failure throws so last good snapshot can be reused |
| `lib/weather.ts` | Borås forecast (Open-Meteo) | 1 hour | Fetch failure throws so last good snapshot can be reused |
| `lib/dailyHeader.ts` | Name day and historical event (Tammergård API/Wikimedia) | 7 days per date key | If both upstreams fail, use last good snapshot |

Two independent GitHub Actions workflows run at minutes 03 and 33 each hour because the Vercel Hobby plan rejected a subdaily Vercel Cron schedule.

- Supplemental fact data is refreshed through `/api/cron/refresh-data`. The route skips before 01:00 Stockholm time, refreshes sources about hourly and retries stale/failed sources on the next half-hour run.
- Editorial articles are refreshed through `/api/cron/refresh-articles`. The route skips before 06:00 Stockholm time, refreshes about hourly after success and retries after a substantial failure on the next half-hour run. It records the article count and source health in private Blob storage.

The workflows call the fixed production URLs and authenticate with short-lived GitHub Actions OIDC tokens. They request tokens with audience `https://glenn-news.vercel.app`; each route verifies the token signature against GitHub's published signing keys and restricts access to this repository, the `main` branch, and its specific workflow. Only scheduled and manually dispatched runs on `main` are accepted. No `GITHUB_CRON_SECRET` or URL variables are required for API authentication.

This Vercel project also has SSO deployment protection enabled for all deployment URLs except custom domains, and currently uses the Vercel-hosted production domain `glenn-news.vercel.app`. Keep that protection enabled. Before external GitHub Actions can reach the protected deployment, generate a Vercel automation-bypass secret in Project Settings → Deployment Protection → Protection Bypass for Automation, then add it to GitHub repository Actions secrets as `VERCEL_AUTOMATION_BYPASS_SECRET`. Both workflows send it in the `x-vercel-protection-bypass` header. This bypass only passes Vercel's outer deployment-protection layer; the route's GitHub OIDC validation remains mandatory. The same Vercel SSO protection lets the owner open the site on mobile/tablet by signing in with the owning Vercel account.

## Snapshot persistence

`lib/supplementalCache.ts` stores the most recent successful supplemental result in private Vercel Blob storage. Returned values include refresh metadata: status, last attempt, last success, and whether the snapshot was persisted. Failed upstream calls return the last known good payload when available, rather than replacing it with empty data.

## Operational caveats

- A successful HTTP response can still contain malformed or incomplete content. Source-specific validation should be tightened whenever a provider's response schema is known.
- Market indices reflect the latest completed trading session; a correct closed-market result is not necessarily stale.
- The first scheduled article refresh occurs at 06:03 Stockholm time, and the half-hour retry workflow begins then; no RSS or editorial article-source request is permitted before 06:00. The 06:30 publication job still performs a final refresh so the edition can include any stories published since the initial cache warm.
- GitHub Actions schedule expressions are UTC; route gates and status timestamps use `Europe/Stockholm`. This means the actual first eligible run happens at 06:03 local time in both daylight and standard time, after the route checks the local clock.


## League table markers

`lib/leagueZones.ts` only returns a zone configuration when the table season begins in 2026, matching the rules catalogued for this release. Promotion, playoff and relegation bands are based on current domestic competition rules. UEFA league-phase positions follow UEFA's 2026/27 format: ranks 1–8 qualify directly for the round of 16, 9–24 enter the knockout playoffs, and 25–36 are eliminated (https://www.uefa.com/uefachampionsleague/news/0291-1bd88ae04870-e1e038c319e3-1000--champions-league-league-phase-standings-how-teams-level-on-/). European places in domestic leagues are deliberately marked preliminary because UEFA performance places, national cup winners and the access list can change the final cut-offs; the UI explains this rather than presenting them as guaranteed.

The 2026 Swedish league playoff rules use the Swedish Football Association's current guidance (https://www.svenskfotboll.se/serier-cuper/kvalspel/kval). English Premier League provisional Europe bands are based on the league's explanation of how cup winners and UEFA performance slots alter qualification (https://www.premierleague.com/en/news/4671711/how-crystal-palace-uefa-conference-league-final-affects-european-qualification).
