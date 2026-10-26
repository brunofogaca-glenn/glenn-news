# Glenn News

Glenn News is a personal Swedish news reader built with Next.js App Router, TypeScript, Vercel Blob, and scheduled GitHub Actions jobs. The homepage serves a prepared morning edition alongside cached supplemental panels. Reader interactions are batched so that the reader profile is updated overnight instead of being rewritten for each click.

## Start here

- **[Architecture map](docs/architecture.md)** — where features live, how data moves, and which performance constraints to preserve.
- **[Data refresh inventory](docs/data-refresh-inventory.md)** — source-specific refresh windows, cache lifetimes, fallback behavior, and operational jobs.
- **[Agent and contributor rules](AGENTS.md)** — how to make changes with minimal investigation, tests, and deployments.

## Main application areas

| Area | Primary files | Responsibility |
| --- | --- | --- |
| Homepage / morning edition | `app/page.tsx`, `lib/dailyEdition.ts` | Render the dated editorial edition and homepage panels. |
| Weekend Week Focus | `app/veckofokus/page.tsx`, `lib/weekFocus.ts`, `lib/weekFocusCache.ts` | Publish one cached deep-dive edition for Saturday and Sunday. |
| Reader profile | `app/profil/page.tsx`, `lib/readerProfile.ts` | Aggregate reading signals and read the compact profile snapshot. |
| Reading queue | `app/components/readerQueue.ts`, `app/components/SaveReadingHistoryButton.tsx` | Queue article reads in the browser and send bounded batches. |
| Supplemental panels | `lib/dailySnapshots.ts`, `lib/sportDay.ts`, `lib/marketDay.ts`, `lib/weather.ts` | Load and cache local, national, world, sport, market, and weather data. |
| Operations / diagnostics | `app/health/page.tsx`, `app/api/health/`, `lib/diagnosticLog.ts` | Inspect source health and operational errors. |

## Development

Use Node.js 22, matching CI.

```bash
npm ci
npm run dev
```

Before proposing a code change, run:

```bash
npm run build
npm run lint
```

`npm run build` already runs the ranking regression tests, refresh/diagnostic regression tests, and the Next.js production build. Do not run those same tests separately and then repeat the full build unless a failing test is being investigated. Vercel skips deployment builds for Markdown-only documentation changes; GitHub Actions still validates those changes.

## Operational notes

- Times and date keys use `Europe/Stockholm`; GitHub cron schedules are configured in UTC.
- Editorial feeds are gated until 06:00. Supplemental and reader-history work runs in its scheduled background windows.
- Do not add Blob writes to every click or move expensive source fetching into React page/components. Prefer existing cache-aware helpers and batch/background processing.
- The initial reader-history migration marker at `.github/run-reader-history-migration` is an operational trigger. Do not edit it unless intentionally re-running that migration.
