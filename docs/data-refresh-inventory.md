# Glenn News: inventory and refresh policy

This inventory distinguishes editorial article ingestion from supplemental homepage panels, reader-history maintenance and browser-scraped source snapshots. Times are local to `Europe/Stockholm`; Vercel cron expressions themselves are UTC.

## Editorial article sources â€” do not fetch before 06:00

| Source / code | Purpose | Rule |
|---|---|---|
| `lib/rss.ts` / `FEEDS` | RSS feeds for the article pool | Never fetched before 06:00 |
| `lib/webSources.ts` / `WEB_SOURCES` | Extract editorial article links from publisher pages | Never fetched before 06:00 |
| `lib/feedHealth.ts` | Checks the health and freshness of RSS and editorial web sources | Never run before 06:00, because checks perform live requests |
| `lib/dailyEdition.ts` | Builds and persists the morning edition | Explicit guard prevents editorial fetch before 06:00 |
| `app/api/cron/refresh-articles/route.ts` | Manual recovery of the article cache and feed-health status | Manual GitHub Actions dispatch only. The automatic morning refresh is owned by `app/api/cron/refresh-news/route.ts` during the 06:00â€“06:59 Stockholm hour |
| `app/api/cron/refresh-news/route.ts` | Publishes the morning edition | Accepts the entire 06:00â€“06:59 Stockholm hour because Hobby cron start minutes are not guaranteed; a second invocation retries only when needed. Protected by production `CRON_SECRET` |

The homepage, direct feed-health page, and manual refresh action are also gated so they ca¶»§q«^