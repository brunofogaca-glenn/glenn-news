# Glenn News: inventory and refresh policy

This inventory distinguishes editorial article ingestion from supplemental homepage panels, reader-history maintenance and browser-scraped source snapshots. Times are local to `Europe/Stockholm`; Vercel cron expressions themselves are UTC.

## Editorial article sources — do not fetch before 06:00

| Source / code | Purpose | Rule |
|---|---|---|
| `lib/rss.ts` / `FEEDS` | RSS feeds for the article pool | Never fetched before 06:00 |
| `lib/webSources.ts` / `WEB_SOURCES` | Extract editorial article links from publisher pages | Never fetched before 06:00 |
| `lib/feedHealth.ts` | Checks the health and freshness of RSS and editorial web sources | Never run before 06:00, because checks perform live requests |
| `lib/dailyEdition.ts` | Builds and persists the morning edition | Explicit guard prevents editorial fetch before 06:00 |
| `app/api/cron/refresh-articles/route.ts` | Manual recovery of the article cache and feed-health status | Manual GitHub Actions dispatch only. The automatic morning refresh is owned by `app/api/cron/refresh-news/route.ts` during the 06:00–06:59 Stockholm hour |
| `app/api/cron/refresh-news/route.ts` | Publishes the morning edition | Accepts the entire 06:00–06:59 Stockholm hour because Vercel Pro Cron delivery time can vary within the scheduled UTC hour; a second invocation retries only when needed. Protected by production `CRON_SECRET` |

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

All schedules are Vercel Cron expressions in UTC. Code-level write guards use `Europe/Stockholm`.

- Supplemental homepage panels use `/api/cron/refresh-data` at `13 0 * * *` and `13 1 * * *`. A successful same-day source refresh makes the second invocation a cheap no-op unless an individual source remains due or stale.
- Reader history uses `/api/cron/process-reader-history` at `15 1,2 * * *`. Both attempts stay inside the 01:00–05:59 local write window. Existing ledger/snapshot idempotence remains in place; the second attempt retries work that remains pending or failed. GitHub Actions is manual recovery only.
- Borås.com is the only browser-scraped publisher source. `/api/cron/refresh-browser-sources` preflights its fixed private Blob path and starts no Sandbox when today's snapshot is already current. Otherwise one ephemeral Vercel Sandbox runs the Borås scraper and the existing ingestion handler validates the payload and preserves last-good data.
- The morning edition uses `/api/cron/refresh-news` at `30 4`, `34 4`, `30 5` and `34 5` UTC, covering the 06:00–06:59 Stockholm hour.

### Blob operation and cost policy

- Browser-source storage uses fixed private Blob paths and `get()` for preflight; it does not call Blob `list()`.
- A normal successful day requires at most one browser snapshot `put()` per source. Borås also refreshes the existing merged local snapshot through its established cache path; keep this write distinct in cost reporting.
- Duplicate Cron deliveries are checked again immediately before the Borås write. This prevents ordinary retries after a successful write. Do not add lock blobs or list-based discovery without measuring the extra advanced-operation cost.
- Reader-history processing still uses its existing Blob `list()` to discover pending batch files under the profile batch prefix. This task adds no new list/index. Removing that operation requires a separate batch-index design.
- Browser Sandbox setup installs the pinned Playwright version and Chromium once per Sandbox execution. It creates no Playwright/Chromium bundle inside the Next.js function and does not touch Blob storage itself.

### Reliability and security invariants

- Vercel Cron can deliver delayed, duplicate or missed invocations and does not automatically retry failures. The second scheduled window is a separate opportunity, not a guarantee.
- All browser ingestion and reader-history writes remain restricted to 01:00–05:59 `Europe/Stockholm`. Editorial RSS and morning edition fetching remain gated until 06:00.
- Vercel Cron authenticates with project `CRON_SECRET`. GitHub Actions manual recovery continues to use short-lived repository/workflow-scoped OIDC. Public `User-Agent` is never sufficient authentication.
- The GitHub Actions workflow for Borås and the reader-history workflow are manual recovery only, plus the restricted one-time reader-history migration-marker push.
- Browser scrape/validation errors return 5xx and preserve last-good snapshots. A job must not report success when required work was skipped.

## Snapshot persistence

`lib/supplementalCache.ts` stores the most recent successful supplemental result in private Vercel Blob storage for weather, sport, market, local, national, world, culture, and daily-header data. Returned values include refresh metadata: status, last attempt, last success, and whether the snapshot was persisted. Failed upstream calls return the last known good payload when available, rather than replacing it with empty data.

The refresh route respects source-specific intervals when deciding to force tag revalidation: weather, sport and national data 1 hour; local 2 hours; world 3 hours; culture 4 hours; market data is proactively refreshed after 20 hours; daily-header data 7 days per date key. The market module's underlying cache TTL remains 24 hours, but the refresh threshold is shorter so the nightly job still updates the market snapshot when the previous run occurred late in its allowed hour and the next one starts early. Stale sources can retry after 25 minutes. A successful report for the current Stockholm date makes the second cron invocation a cheap no-op; a failed/incomplete report remains eligible for retry.

## Operational caveats

- A successful HTTP response can still contain malformed or incomplete content. Tighten source-specific validation whenever a provider's response schema is known.
- Market values must be interpreted using their observation date, not only the snapshot fetch time. If Brent (`BZ=F`) is older than the latest date among the other market indicators, the world snapshot is marked stale, the last-good snapshot is preserved rather than overwritten with the partial result, and the second nightly refresh remains eligible to retry. The homepage shows a per-Brent observation-lag label and an overall stale-snapshot warning. A correct older close can still be normal on non-trading days; the comparison flags source lag, not a universal same-day requirement.
- The Sportdygn league-table provider payload consumed by `lib/sportDay.ts` does not expose a distinct observation timestamp. The UI therefore labels the time Glenn News retrieved the table, explicitly says that it is not the underlying observation time, and displays stale last-good snapshot metadata where available. Do not equate snapshot retrieval time with proof that the table itself was updated.
- No RSS or editorial article-source request is permitted before 06:00. Supplemental snapshots run through Vercel Cron before the morning edition. The 06-hour publication endpoint refreshes RSS and feed health, then saves the dated edition; the homepage can generate a fallback edition after 06:00 if scheduled publication fails.
- Vercel Cron can deliver delayed, duplicate or missed invocations and does not automatically retry failed invocations. The two scheduled windows reduce dependence on one delivery but do not guarantee provider availability. If both miss/fail, check the **Nattlig uppdatering** report and Vercel Runtime Logs, then use GitHub Actions manual recovery during the permitted nightly window.
- Browser ingestion and reader history run automatically through Vercel Cron. GitHub Actions workflows remain available for manual OIDC-protected recovery, only within `01:00–05:59 Europe/Stockholm`; never weaken the write-window guard. The endpoints return visible failures when required processing cannot complete.

## League table markers

`lib/leagueZones.ts` only returns a zone configuration when the table season begins in 2026, matching the rules catalogued for this release. Promotion, playoff and relegation bands are based on current domestic competition rules. UEFA league-phase positions follow UEFA's 2026/27 format: ranks 1–8 qualify directly for the round of 16, 9–24 enter the knockout playoffs, and 25–36 are eliminated (https://www.uefa.com/uefachampionsleague/news/0291-1bd88ae04870-e1e038c319e3-1000--champions-league-league-phase-standings-how-teams-level-on-/). European places in domestic leagues are deliberately marked preliminary because UEFA performance places, national cup winners and the access list can change the final cut-offs; the UI explains this rather than presenting them as guaranteed.

The 2026 Swedish league playoff rules use the Swedish Football Association's current guidance (https://www.svenskfotboll.se/serier-cuper/kvalspel/kval). English Premier League provisional Europe bands are based on the league's explanation of how cup winners and UEFA performance slots alter qualification (https://www.premierleague.com/en/news/4671711/how-crystal-palace-uefa-conference-league-final-affects-european-qualification).


## Incident notes — 29 October 2026

- The Fotbollskanalen browser integration was retired on 3 November 2026. Its workflow, scraper, ingestion route, private snapshot store and editorial source configuration were removed. Borås.com remains the only browser-scraped publisher source.
- The supplemental refresh was reported OK at 01:13 Stockholm. Treat that as refresh/snapshot status only, not proof the underlying observation is same-day. Brent uses Yahoo Finance `BZ=F` daily data and intentionally selects a completed daily observation before the current Stockholm date. Verify the data date and visible stale metadata separately from snapshot fetch time; the latest completed market close can legitimately be from an earlier date on non-trading days or before a close is published.
- Category misclassification is under investigation in [issue #49](https://github.com/brunofogaca-glenn/glenn-news/issues/49): `lib/rss.ts` prefers `detectCategory(article)` over each feed's configured category. Add representative category/ranker regression cases; do not repair this with arbitrary filler or fixed article quotas.
- Durable triage and recovery details: [2026-10-29 morning data quality incident](incident-notes/2026-10-29-morning-data-quality.md).

### Borås.com long-lived event catalog (PBI #99)

- The browser scraper uses BORAS_EVENTS_HORIZON_DAYS (default 180; allowed range 60–365) and emits complete=true only after the rendered listing reaches five stable rounds with no enabled “visa fler” control. A failed click, 1,500-link safety-limit breach, or failure to reach that terminal state aborts the scrape.
- Ingestion requires both complete=true and the exact configured horizon. It validates event dates and canonicalizes Borås.com event URLs before deduplication and merge.
- A successful scrape upserts new/changed entries. A future event missing from one complete listing remains active; after three consecutive complete listings omit it, its status becomes unlisted. It remains in the private archive until 30 days after its end/event date. An explicit cancellation marker in a Borås.com event card changes status immediately. Absence in one or two complete listings, or in any incomplete listing, never cancels a future event.
- Storage remains one fixed private Blob object: glenn-news/boras-events/browser-scrape.json. Legacy v1 snapshots remain readable. Version 2 keeps savedAt, checkedAt and contentUpdatedAt separately. A snapshot older than 72 hours is marked stale but remains available as last-good data for up to one year.
- Each successful daily check performs one catalog put() at most. Identical content updates the check timestamp but does not invalidate/rebuild the merged local homepage snapshot. A real content change revalidates that existing snapshot through the established cache path. No Blob list(), lock object, per-event object or new index is added.
- Existing Vercel Cron schedules, 01:00–05:59 Europe/Stockholm write guard, scoped auth, preflight/no-op retry behavior and private Blob access are unchanged. A real overnight run is still required to verify the live Borås.com pagination behaviour and production freshness/cost before closing this PBI.

- Cost/cache note: the `missingCompleteScrapes` counter is catalog metadata and is excluded from the homepage content fingerprint. The first and second complete absences therefore update only the catalog snapshot; the third absence changes the visible `active` → `unlisted` status and triggers the existing local-snapshot revalidation.
