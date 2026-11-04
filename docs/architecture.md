# Glenn News â€” architecture and change map

This is the quick map for making a targeted change without needing to rediscover the whole repository. Keep it in sync when a data flow or cross-module contract changes. **Before any task, start with the canonical [product requirements](product-requirements.md)** and identify the relevant requirement IDs. For the complete inventory of visible UI and interactions, see [UI and feature guide](ui-feature-guide.md).

## Request and data flows

### Morning homepage

1. Vercel Pro Cron call `app/api/cron/refresh-news/route.ts` in the Stockholm 06:00â€“06:59 hour. It refreshes RSS/feed health and persists the daily edition; `app/api/cron/refresh-articles/route.ts` is manual recovery only. RSS and publisher-page adapters live in `lib/rss.ts` and `lib/webSources.ts`.

   **Per-source failure boundary:** `lib/rss.ts` fetches the RSS feed list with `Promise.allSettled`; a failed endpoint is logged and excluded without rejecting the other feed results. `lib/feedHealth.ts` converts each individual RSS/web failure into that source's `error` status. The morning route separately decides whether the aggregate error count warrants a retry; a single provider 5xx is not automatically a whole-job failure.
2. Editorial selection, validation, duplicate prevention, and dated publication live in `lib/dailyEdition.ts`, `lib/editorV2.ts`, and `lib/ranker.ts`.
3. `app/page.tsx` composes the saved morning edition with cached supplemental panels. Keep provider ¶»§q«^