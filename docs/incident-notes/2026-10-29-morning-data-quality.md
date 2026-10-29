# Morning data quality incident and production closeout — 29 October 2026

## What was observed

- The saved morning edition placed an Expressen football analysis in **Kultur, Mat & Livsstil**. The cause was source/category inference allowing broad text matches to outrank reliable football-source signals.
- /health reported the latest dated Fotbollskanalen article as 24 October 2026 at 14:00 Stockholm time (about 115 hours old).
- GitHub Actions run [#25 on 29 October](https://github.com/brunofogaca-glenn/glenn-news/actions/runs/40833131784) failed the nightly-window guard at 07:04:55 UTC (08:04:55 Stockholm). Run [#24 on 28 October](https://github.com/brunofogaca-glenn/glenn-news/actions/runs/40646434245) failed the same guard at 06:51:43 UTC (07:51:43 Stockholm). Scraping and ingestion were skipped because the jobs started after 06:00.
- The world snapshot displayed Brent at USD 113.88 with observation date 27 October while other market observations were dated 28 October.
- The sport panel showed results dated 28 October and a snapshot retrieval time of 29 October 01:13. That retrieval timestamp did not independently prove the selected league table was current.

## Implemented and deployed in PR #50

Production commit: [403464d](https://github.com/brunofogaca-glenn/glenn-news/commit/403464dbec1679ab7d530dfecac2b188910c514d). The Vercel deployment was READY and main CI passed.

- Categorization now gives football/source signals priority over broad lifestyle/economy keyword matches; regression tests protect the reproduced football-to-lifestyle leakage.
- Fotbollskanalen ingestion has an authenticated read-only preflight, same-day idempotency, a 72-hour newest-article requirement, and a minimum of six valid articles. It preserves the last-good snapshot and rejects writes outside 01:00–05:59 Europe/Stockholm.
- Brent's Yahoo BZ=F history is compared with the other market dates and the implementation tries a Financial Times historical-close fallback when Yahoo trails. Stale status remains visible if a newer valid close cannot be fetched.
- The existing saved morning edition is deliberately immutable during the day; category improvements take effect in the next generated edition.

## Follow-up hardening

- The Fotbollskanalen workflow is being increased from four to eight scheduled opportunities: minutes 17 and 47 during UTC hours 00, 01, 02 and 03. Every opportunity remains inside the allowed Stockholm window across the daylight-saving change. The preflight keeps successful retries cheap by skipping browser installation, scraping, ingestion and Blob writes once today's snapshot has a newest article no older than 72 hours.
- Production logs showed Next.js data-cache warnings for the large Fotbollskanalen fallback HTML response (~3.4 MB, over the 2 MB cache limit). The fallback request is changed to cache: no-store for this source only; other publisher sources keep their 15-minute cache.
- The sport table panel now distinguishes the time Glenn News retrieved the table from the underlying observation date, because the fields consumed from FotMob do not expose an independent observation timestamp. It also shows last-good snapshot metadata when available.

## Verification status — do not overstate

The code deployment and regression checks confirm the fixes are present; they do not prove that a fresh Fotbollskanalen import or Brent snapshot has already been stored. The next permitted overnight run is the first valid opportunity to verify those live data changes without breaking the daytime write guard.

At the source-side check on 29 October, Financial Times historical data showed a completed Brent close of USD 115.90 dated 28 October, newer than the stored USD 113.88 dated 27 October. Confirm that this value/date is reflected by Glenn News after the next overnight refresh.

After the next nightly run, check:

1. The Refresh Fotbollskanalen articles workflow: scrape count at least 6, ingest HTTP success and saved snapshot date.
2. /health: latest Fotbollskanalen article date advances and source is no longer stale.
3. The next generated edition: the football headline is not shown as a normal culture/lifestyle story.
4. The world snapshot: Brent date/value advances or the stale warning remains explicit if the fallback fails.
5. Sport data: results/table retrieval timestamp advances; remember that the table's actual observation date is not independently supplied by this provider.

The daytime refresh guard and last-good snapshot protection are intentional invariants. Do not trigger protected scrape or Blob writes outside 01:00–05:59 Stockholm time. See [issue #49](https://github.com/brunofogaca-glenn/glenn-news/issues/49) for the closeout trail.


## Reader-history workflow delay — afternoon follow-up, 29 October 2026

- GitHub Actions [reader-history run #5](https://github.com/brunofogaca-glenn/glenn-news/actions/runs/40841894385) started at 09:24 Stockholm and failed at the local-time guard. The job log confirms that the processing step was skipped; it did not reach the ledger/profile writer, so this run did not produce a Blob write.
- The root cause evidenced by the log is schedule delay, not a confirmed reader-history processor defect. The workflow and endpoint retain the `01:00–05:59 Europe/Stockholm` write guard.
- Recovery follow-up is tracked in [issue #54](https://github.com/brunofogaca-glenn/glenn-news/issues/54). The proposed code change adds a second in-window schedule opportunity, reserves `manual=1` for the restricted migration-marker push, verifies that the endpoint did not return a skipped response, and prevents repeated snapshot writes when the stored profile matches the ledger marker.
- This change is not considered production-verified until a valid scheduled run completes and the saved ledger/profile are checked.
