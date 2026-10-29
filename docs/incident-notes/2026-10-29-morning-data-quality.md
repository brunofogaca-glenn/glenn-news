# Manual recovery notes — 29 October 2026

## Confirmed production observations
- The production `/health` page reports the supplemental refresh at 01:13 Stockholm time as OK. The panel reports sport/tables and market as "Cache OK"/"Uppdaterad", so this is not by itself proof of fresh underlying match/market observations.
- The world snapshot obtains Brent from Yahoo Finance's `BZ=F` daily series. The code intentionally excludes the current Stockholm date and uses the latest earlier date, which can be normal before the market closes but its observation date must be checked separately from the snapshot fetch time.
- The `/health` page marks Fotbollskanalen stale: latest dated article shown was 24 Oct 2026 14:00 Stockholm, about 115 hours old.
- GitHub Actions run [#25, 29 Oct 2026](https://github.com/brunofogaca-glenn/glenn-news/actions/runs/40833131784) failed in **Check nightly maintenance window** at 07:04:55 UTC (08:04:55 Stockholm). The scrape, install and ingest steps were skipped.
- GitHub Actions run [#24, 28 Oct 2026](https://github.com/brunofogaca-glenn/glenn-news/actions/runs/40646434245) failed in the same guard at 06:51:43 UTC (07:51:43 Stockholm). Its scrape and ingest steps were skipped.
- The workflow schedule is `17 1 * * *` UTC, but GitHub Actions can delay scheduled jobs. In this case the guard fails the run because it arrived after the allowed 01:00–05:59 Stockholm window. That protects daytime write/cost constraints but means no article scrape/ingest took place on those days.

## Recovery procedure
1. During the permitted Stockholm 01:00–05:59 window, manually dispatch the `Refresh Fotbollskanalen articles` workflow in GitHub Actions, inspect the run logs, and confirm the scrape step finds at least 6 recent articles and ingestion returns success.
2. Do not dispatch it outside that window: the guard and ingestion endpoint correctly reject late writes. Do not weaken the guard without explicitly reviewing the daytime write-cost/data freshness constraints.
3. Verify `/health` marks Fotbollskanalen fresh and its latest article date advances.
4. Use the `Nattlig uppdatering` status and the current market/sport data dates to distinguish fetch status from underlying data date. Inspect actual match table/provider timestamps and Brent's `date`; a snapshot saved at 01:13 may contain the last available daily close rather than a market tick from that day.
5. Follow up on issue #49 for the category misclassification and stale/last-good indicators. Keep the good snapshot fallback in place, but make stale source data obvious in the UI.

## Category review clue
`lib/rss.ts` chooses `detectCategory(article) ?? feed.category`. `lib/categorizer.ts` uses title/description keyword matching, with lifestyle/culture and economy/football rules. Add focused fixtures to the ranker/category regression tests; do not solve this by adding arbitrary filler or hard-coded article quotas.
