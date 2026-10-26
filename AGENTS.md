# Working rules for Glenn News

The goal is to deliver correct changes with the **smallest relevant investigation, one coherent patch, and minimal repeated validation**. This is a live production application; avoid unnecessary code churn and repeated deployments.

## Fast path for every task

1. Read the relevant section of [docs/architecture.md](docs/architecture.md). Read [docs/data-refresh-inventory.md](docs/data-refresh-inventory.md) only when the task touches feeds, snapshots, caches, or schedules.
2. Use the architecture map to find the owning route/module and its closest regression test. Inspect those files first. Do not recursively inventory the entire repo unless the task is explicitly architectural.
3. Search for an existing helper before inventing another one. Make one complete, tightly scoped patch rather than a sequence of speculative micro-fixes.
4. For code changes, run `npm run build` once; this already runs the regression suites before `next build`. Run `npm run lint` when TypeScript/React/source files change. Do not repeat successful checks without a new failure or a relevant new edit.
5. Review only the changed diff and the specific checks relevant to it. Avoid broad log dumps; pull the failing section when diagnosing an error.
6. Prefer a single branch and one pull request per coherent task. Do not push directly to `main` unless explicitly requested; each production-branch commit can trigger another Vercel build. Avoid creating a deployment for every intermediate fix.

## Production invariants

- **Blob operations are costly.** Do not add per-click, per-article, or per-render writes. Queue reading activity in the browser and submit bounded batches; process them in the nightly job.
- **Never replace valid history with empty data after a transient read/parse failure.** Preserve ledger validation, idempotent batch processing, and last-good-snapshot fallbacks.
- **Prefer cache-aware read helpers** such as the existing `getCached…` functions. Do not add direct live-source fetches inside page components when an established cache/fallback layer exists.
- Keep editorial ingestion blocked before 06:00 `Europe/Stockholm`. Supplemental refreshes and reader-history maintenance have their own scheduled windows; follow the inventory rather than duplicating schedule logic.
- Week Focus is available on Saturday and Sunday and uses one weekend edition keyed to Saturday's Stockholm date. Preserve precomputation, caching, and request coalescing.
- Reader-profile snapshots and the consolidated history ledger are written by background maintenance. The authenticated `manual=1` reader-history route must remain behind GitHub Actions OIDC authorization.
- Treat `.github/run-reader-history-migration` as a one-time migration trigger. Do not touch that path casually.
- Update documentation when a change alters a data flow, storage contract, refresh window, or other cross-module invariant.

## Comments and structure

- Comment on **why** a non-obvious behavior exists, especially around caching, idempotency, time windows, migration, fallback, or expensive I/O. Do not add line-by-line narration of obvious code.
- Keep UI, route handlers, source adapters, cache/storage logic, and pure ranking/editorial helpers in their current responsibility areas. Split a large module only when the new boundary is clear and tests can protect it; avoid renaming/moving many files just for cosmetic consistency.
- Prefer small helpers with one responsibility over duplicate logic. Keep exports stable when splitting internals, unless an API change is required.
- Keep summaries concise: report what changed, tests run, and any remaining uncertainty.

## Commands

- `npm run dev` — local development server.
- `npm run build` — ranking tests + refresh/diagnostic tests + Next.js production build.
- `npm run lint` — ESLint.
- `npm run test:ranker` — ranking regression suite only.
- `npm run test:refresh` — refresh and diagnostic regression suites only.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Build efficiency

- Vercel's ignored-build rule skips only Markdown-only edits. If the change includes code, config, tests, scripts, assets, workflows, or dependency files, retain the normal build. The ignore check fails closed (builds) when Git SHAs or the diff are unavailable.
