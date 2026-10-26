# Glenn News: inventory and refresh policy

This inventory distinguishes editorial article ingestion from the supplemental fact panels on the homepage. Times are local to `Europe/Stockholm`; Vercel cron expressions themselves are UTC.

## Editorial article sources — do not fetch before 06:00

| Source / code | Purpose | Rule |
|---|---|---|
| `lib/rss.ts` / `FEEDS` | RSS feeds for the article pool | Never fetched before 06:00 |
| `lib/webSources.ts` / `WEB_SOURCES` | Extract editorial article links from publisher pages | Never fetched before 06:00 |
| `lib/feedHealth.ts` | Checks the health and freshness of RSS and editorial web sources | Never run before 06:00, because checks perform live requests |
| `lib/dailyEdition.ts` | Builds and persists the morning edition | Explicit guard prevents editorial fetch before 06:00 |
| `app/api/cron/refresh-articles/route.ts` | Manual recovery of the article cache and feed-health status | Manual GitHub Actions dispatch only. The automatic morning refresh is owned by `app/api/cron/refresh-news/route.ts` during the 06:00–06:59 Stockholm hour |
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

## Actual schedule and ordering

The Hobby schedule is intentionally conservative: the Vercel cron expressions are daily, but Hobby does **not** guarantee the minute within the selected UTC hour. Vercel documents a possible 0–59 minute spread inside that hour, and it does not automatically retry failed cron invocations. Therefore, `/api/cron/refresh-news` accepts the full 06:00–06:59 Stockholm hour instead of relying on minute 30/34. Four daily entries cover both UTC offsets: 04:30/04:34 UTC during Swedish summer time and 05:30/05:34 UTC during standard time; the other pair is rejected by the Stockholm-hour guard. The second invocation can retry if the article status says `retry`, while a valid already-published edition is skipped. If both scheduled attempts fail, the homepage still has its own edition-generation fallback after 06:00.

The other background jobs are GitHub Actions schedules (UTC), ordered to leave a buffer before the morning edition:

- Supplemental fact data is refreshed through `/api/cron/refresh-data` once each night by `.github/workflows/refresh-supplemental-data.yml` at `00:43 UTC` (01:43 CET / 02:43 CEST). The route skips before 01:00 and after 06:00 Stockholm time. Daytime page requests prefer the last good snapshot and do not persist refreshes.
- Editorial articles and the saved morning edition are refreshed through `/api/cron/refresh-news` during the 06:00–06:59 Stockholm hour. The first invocation checks article-cache contents and source health; an additional invocation retries only when the status is `retry`. The route records article count and source health in private Blob storage. `/api/cron/refresh-articles` is a manual recovery path, not an automatic hourly schedule.

The workflows call the fixed production URLs and authenticate with short-lived GitHub Actions OIDC tokens. They request tokens with audience `https://glenn-news.vercel.app`; each route verifies the token signature against GitHub's published signing keys and restricts access to this repository, the `main` branch, and its specific workflow. Only scheduled and manually dispatched runs on `main` are accepted. No `GITHUB_CRON_SECRET` or URL variables are required for API authentication.

This Vercel project also has SSO deployment protection enabled for all deployment URLs except custom domains, and currently uses the Vercel-hosted production domain `glenn-news.vercel.app`. Keep that protection enabled. Before external GitHub Actions can reach the protected deployment, generate a Vercel automation-bypass secret in Project Settings → Deployment Protection → Protection Bypass for Automation, then add it to GitHub repository Actions secrets as `VERCEL_AUTOMATION_BYPASS_SECRET`. Both workflows send it in the `x-vercel-protection-bypass` header. This bypass only passes Vercel's outer deployment-protection layer; the route's GitHub OIDC validation remains mandatory. The same Vercel SSO protection lets the owner open the site on mobile/tablet by signing in with the owning Vercel account.

## Snapshot persistence

`lib/supplementalCache.ts` stores the most recent successful supplemental result in private Vercel Blob storage. Returned values include refresh metadata: status, last attempt, last success, and whether the snapshot was persisted. Failed upstream calls return the last known good payload when available, rather than replacing it with empty data.

## Operational caveats

- A successful HTTP response can still contain malformed or incomplete content. Source-specific validation should be tightened whenever a provider's response schema is known.
- Market indices reflect the latest completed trading session; a correct closed-market result is not necessarily stale.
- No RSS or editorial article-source request is permitted before 06:00. Supplemental snapshots, Borås events, Fotbollskanalen browser ingestion, and reader-history/profile consolidation run in the night window before the morning edition. The 06-hour publication endpoint refreshes RSS and feed health, then saves the dated edition; the homepage can generate a fallback edition after 06:00 if a scheduled invocation did not produce one.
- GitHub Actions cron expressions use UTC, while the ingestion guards and status timestamps use `Europe/Stockholm`. Expected order is Borås scrape at `00:13 UTC`, supplemental snapshots at `00:43 UTC`, Fotbollskanalen browser ingestion at `01:17 UTC`, reader-history consolidation at `02:15 UTC`, then morning publication in the UTC hour that maps to 06:00 Stockholm time. Hobby queue jitter can change exact start minutes, so routes enforce their local safety windows rather than trusting the scheduled minute.


## League table markers

`lib/leagueZones.ts` only returns a zone configuration when the table season begins in 2026, matching the rules catalogued for this release. Promotion, playoff and relegation bands are based on current domestic competition rules. UEFA league-phase positions follow UEFA's 2026/27 format: ranks 1–8 qualify directly for the round of 16, 9–24 enter the knockout playoffs, and 25–36 are eliminated (https://www.uefa.com/uefachampionsleague/news/0291-1bd88ae04870-e1e038c319e3-1000--champions-league-league-phase-standings-how-teams-level-on-/). European places in domestic leagues are deliberately marked preliminary because UEFA performance places, national cup winners and the access list can change the final cut-offs; the UI explains this rather than presenting them as guaranteed.

The 2026 Swedish league playoff rules use the Swedish Football Association's current guidance (https://www.svenskfotboll.se/serier-cuper/kvalspel/kval). English Premier League provisional Europe bands are based on the league's explanation of how cup winners and UEFA performance slots alter qualification (https://www.premierleague.com/en/news/4671711/how-crystal-palace-uefa-conference-league-final-affects-european-qualification).
