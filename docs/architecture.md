# Glenn News — architecture and change map

This is the quick map for making a targeted change without needing to rediscover the whole repository. Keep it in sync when a data flow or cross-module contract changes. **Before any task, start with the canonical [product requirements](product-requirements.md)** and identify the relevant requirement IDs. For the complete inventory of visible UI and interactions, see [UI and feature guide](ui-feature-guide.md).

## Request and data flows

### Morning homepage

1. Vercel Hobby crons call `app/api/cron/refresh-news/route.ts` in the Stockholm 06:00–06:59 hour. It refreshes RSS/feed health and persists the daily edition; `app/api/cron/refresh-articles/route.ts` is manual recovery only. RSS and publisher-page adapters live in `lib/rss.ts` and `lib/webSources.ts`.
2. Editorial selection, validation, duplicate prevention, and dated publication live in `lib/dailyEdition.ts`, `lib/editorV2.ts`, and `lib/ranker.ts`.
3. `app/page.tsx` composes the saved morning edition with cached supplemental panels. Keep provider parsing and live fetching out of the page component.

**Key files:** `app/page.tsx`, `lib/dailyEdition.ts`, `lib/rss.ts`, `lib/webSources.ts`, `lib/editorV2.ts`, `lib/ranker.ts`.

Visible sections, interactions, responsive navigation and empty/error states are documented in [UI and feature guide](ui-feature-guide.md).

### Supplemental homepage panels

- `app/api/cron/refresh-data/route.ts` is the background refresh entry point, called by two Vercel Cron entries at 00:13 and 01:13 UTC. Their invocation windows land at local hours 01/02 in standard time and 02/03 in daylight-saving time; both are before the 06:00 cutoff.
- Vercel Cron authenticates with the production `CRON_SECRET`. The GitHub Actions supplemental workflow is manual recovery only and uses repository/workflow-scoped OIDC with `force=1`. A successful run for the same Stockholm date makes the backup invocation a cheap no-op; failed/incomplete runs can be retried.
- Out-of-window calls return HTTP 503 rather than a successful skip. Missed browser-ingestion and reader-history windows fail visibly instead of producing green no-op jobs.
- `lib/dailySnapshots.ts` contains source adapters and parsers for local events, national/parliament news, culture reviews, and world indicators.
- Sport, market, weather, and daily header data have dedicated modules: `lib/sportDay.ts`, `lib/marketDay.ts`, `lib/weather.ts`, and `lib/dailyHeader.ts`. All use the last-good-snapshot contract, including market data. A successful Borås browser ingestion rebuilds the merged local snapshot immediately.
- The refresh route respects per-source refresh intervals rather than applying one hourly threshold to every source. Market data is revalidated after 20 hours (while its underlying cache TTL stays at 24 hours) to account for the variable run minute on Vercel Hobby. Exact intervals and fallbacks are in [data-refresh-inventory.md](data-refresh-inventory.md).

### Reading history and personalization

1. `app/components/TrackableLink.tsx` and `WeeklyStoryLink.tsx` send interaction information to the browser queue in `app/components/readerQueue.ts`.
2. `SaveReadingHistoryButton.tsx` posts up to 50 queued events to `app/api/events/batch/route.ts`; the route makes one bounded batch write.
3. `lib/readerProfile.ts` stores incoming batches under `glenn-news/profile/batches/`, consolidates processed history in `reader-history-ledger.json`, and reads the compact `reader-profile-snapshot.json` for typical daytime use.
4. `app/api/cron/process-reader-history/route.ts` runs the nightly maintenance: consume new batches, safely persist the ledger, refresh the profile snapshot, retry eligible Week Focus read marks, and optionally precompute Saturday's edition.

**Performance contract:** no per-click Blob writes or per-article AI classification in the reading session. A failed ledger read/write must not be interpreted as an empty history or overwrite the last good snapshot.

### Weekend Week Focus

- The page is `app/veckofokus/page.tsx`; it is intentionally inactive Monday through Friday.
- Candidate collection, reading-interest calculations, quality filtering, ranking, and editorial generation live in `lib/weekFocus.ts` and the small `weekFocusCandidates.ts`, `weekFocusInterests.ts`, and `weekFocusQuality.ts` helpers.
- `lib/weekFocusCache.ts` keeps one fixed edition for Saturday and Sunday, keyed to Saturday in the Stockholm timezone. It uses memory/persistent cache and coalesces concurrent generation.

**Performance contract:** keep the Saturday precompute and weekend cache. Don't regenerate an edition for each page request or use a weekday-specific key.

## File map by concern

| Concern | Primary location |
| --- | --- |
| App routes and page composition | `app/**/page.tsx` |
| HTTP/API entry points | `app/api/**/route.ts` |
| Reusable UI and browser interaction | `app/components/` |
| RSS and publisher-page ingestion | `lib/rss.ts`, `lib/webSources.ts`, `lib/categorizer.ts` |
| Article types, normalization, classification | `lib/articleType.ts`, `lib/articleUrl.ts`, `lib/categorizer.ts` |
| Editorial ranking and generation | `lib/ranker.ts`, `lib/editorV2.ts`, `lib/dailyEdition.ts` |
| Personalization and history | `lib/readerProfile.ts`, `lib/weeklyRead.ts`, `lib/weekFocus*.ts` |
| Supplemental snapshots and fallbacks | `lib/dailySnapshots.ts`, `lib/supplementalCache.ts`, source-specific `*Cache.ts` modules |
| Job orchestration and authorization | `.github/workflows/`, `lib/githubActionsAuth.ts`, `app/api/cron/` |
| Regression protection | `tests/ranker-regression.test.cjs`, `tests/data-refresh-regression.test.cjs`, `tests/diagnostic-log-regression.test.cjs` |

## How to make common changes

- **Change a visual/UI detail:** start at the relevant `app/**/page.tsx` or component; avoid touching source ingestion or storage.
- **Change ranking/selection behavior:** start at the named helper under `lib/` and its regression test; add a focused test for the new contract.
- **Change a feed, parser, snapshot, cache, or schedule:** consult [data-refresh-inventory.md](data-refresh-inventory.md), then update that document if the operational behavior changes.
- **Change reader-history processing:** inspect the batch API, `lib/readerProfile.ts`, the nightly route, and the relevant test together.
- **Change an authenticated job:** inspect both the route and its GitHub workflow. Preserve repository/workflow scoping and OIDC audience checks; don't broaden authorization for convenience.

## Build and deployment efficiency

- `vercel.json` uses `scripts/vercel-ignore-build.mjs` to skip Vercel builds only when the full change set consists of Markdown files in `docs/` or the root documentation files. Code, assets, configuration, tests, scripts, workflows, and lockfiles keep the normal build.
- The ignore script uses Vercel's previous-successful-deployment SHA and current commit SHA. If either SHA or the diff is unavailable, it fails closed by allowing the build.
- Vercel Hobby cron schedules do not guarantee the exact minute within the UTC hour; morning publication and supplemental refresh use redundant scheduled entries and local Stockholm time guards. Routes use `CRON_SECRET` for Vercel Cron and never trust a spoofable `User-Agent`.
- GitHub Actions scheduled workflows can be delayed or dropped. Browser-ingestion and reader-history guards must fail visibly if a run misses its nightly window, rather than return a green no-op.
- GitHub Actions runs regression suites for application/test changes, while Vercel owns Next.js compilation. Markdown-only changes skip both workflows. Local `npm run build` remains the full test-and-build command.
- Recent and weekly reader-activity queries read the consolidated ledger first. Legacy per-click payloads are downloaded only when their timestamps could change the visible top-N; a legacy-list failure preserves ledger-backed activity instead of turning the view empty.

## Validation and deployment

GitHub Actions runs the ranking and refresh/diagnostic regression suites; Vercel runs `npm run build:vercel` (`next build`) for preview and production compilation. This avoids compiling the same Next.js app a second time in GitHub Actions. Locally, `npm run build` still runs both regression suites and a full production build. Documentation-only changes skip both checks. Run `npm run lint` for source edits.

The CI workflow is `.github/workflows/ci.yml`. Cron schedules and refresh authentication are in `.github/workflows/`; the operational source of truth for data times is [data-refresh-inventory.md](data-refresh-inventory.md).
