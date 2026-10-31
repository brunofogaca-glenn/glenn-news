# Glenn News — UI and feature guide

This is the source-oriented handbook for the **user-visible interface**. It records what each page currently does, which interactions exist, where the behavior is implemented, and which contracts future agents must preserve. Keep it aligned with the code whenever a route, component, label, user interaction, empty state, or navigation flow changes.

For data-source schedules and cache lifetime, read [Data refresh inventory](data-refresh-inventory.md). For the main code/data-flow map, read [Architecture](architecture.md). Contributor workflow and production invariants are in [AGENTS.md](../AGENTS.md).

The homepage sport panel and supplemental panel footers display the snapshot fetch date/time in the Stockholm timezone. The sport table also shows when Glenn News retrieved the table response and explicitly states that FotMob does not expose a distinct observation timestamp in the consumed payload. A stale sport snapshot shows its last saved time and explanatory status. The market panel displays each market's actual trading-session date separately from snapshot fetch time; these may differ because of weekends, holidays or source availability.

## At a glance

Glenn News is a Swedish, personalized, AI-edited morning newspaper. The interface has four pages:

| Route | Navigation label | Purpose |
| --- | --- | --- |
| `/` | Tidning | The saved daily edition and supplemental homepage panels. |
| `/veckofokus` | Veckofokus | A weekend-only set of unread deep dives selected from recent reading signals and saved editions. |
| `/profil` | Profil | The reader profile, reading patterns, interest signals, and recent registered activity. |
| `/health` | Källor | Editorial source health, saved refresh-run status, and diagnostic logs. |

The page implementations are `app/page.tsx`, `app/veckofokus/page.tsx`, `app/profil/page.tsx`, and `app/health/page.tsx`. Navigation and reading-history controls are shared components under `app/components/`.

## Shared layout and interaction

### Visual shell and navigation

- `app/layout.tsx` sets the Swedish document language, global metadata, fonts and page shell.
- The visual system uses a warm paper background, prominent serif headlines, black divider rules and orange emphasis. Responsive Tailwind classes adjust the layouts for mobile, tablet and desktop.
- `app/components/MobileNav.tsx` supplies a fixed bottom navigation on mobile with four destinations: **Tidning**, **Veckofokus**, **Profil** and **Källor**. It identifies the current route with `aria-current="page"` and a visual marker. The content wrapper reserves bottom space so the fixed nav does not cover the page.
- On desktop, the homepage header exposes Veckofokus, Min profil and Flödesstatus links. Other pages provide a link back to the newspaper, while the mobile nav remains available on every page.

### Article clicks and reading-history saving

Relevant files: `TrackableLink.tsx`, `WeeklyStoryLink.tsx`, `readerQueue.ts`, `SaveReadingHistoryButton.tsx`, `app/api/events/batch/route.ts`, `lib/readerProfile.ts`.

1. News cards use `TrackableLink`; Week Focus stories use `WeeklyStoryLink`. They open the original article in a separate tab and queue the click metadata in browser `sessionStorage`. Signals include category, article type, source, topic, title and article URL.
2. A click updates the small in-page read counter through the `glenn-reader-click` browser event. This counter is an immediate UI signal, not proof that the server-side profile has already been updated.
3. The queue is per browser tab and does **not** send a network request or write a Blob for every click. The user explicitly presses **Spara läshistorik** after reading.
4. One save sends up to 50 events to `POST /api/events/batch`. Larger queues remain in place for another save. A failed save keeps the unsaved events in the queue and offers a retry message.
5. Successful batches are marked for nightly processing. The overnight workflow consolidates events into the shared ledger and profile snapshot; reading history therefore syncs through Glenn News rather than being recomputed for each page render.

The save control is mounted by the shared layout but only renders for its intended page: **Spara morgonens läsning** on `/`, or **Spara Veckofokus-läsning** on `/veckofokus`. A zero-length queue disables the button. Do not add per-click API calls, AI classification or Blob writes to the article-link components.

## 1. Tidning — `/`

Primary file: `app/page.tsx`. Editorial generation and validation: `lib/dailyEdition.ts`.

### Header and edition status

- Shows the Glenn News masthead, the current Stockholm-local date, name days, and a historical event when available.
- Displays the edition's generation time and article count. The small read counter starts from the profile total and increments locally as articles are opened.
- The Flödesstatus link is visually highlighted and shows the number of source errors when the saved feed-health result reports errors.
- The **Uppdatera källor** control is available during the pre-06:00 maintenance window only. In the current implementation it refreshes the underlying supplemental panels and refreshes the server-rendered page; because this window is before 06:00, it does **not** fetch editorial RSS/article sources or run editorial feed-health checks. It deliberately does **not** regenerate or rewrite today's saved morning edition. Use the separate edition-retry action for that recovery path.
- Weather appears only when forecast data is available. The panel shows today and tomorrow for Borås, with conditions, high/low temperature, precipitation probability and amount, and wind.

### Morning edition and recovery states

- The saved edition still contains seven editorial data sections (Elfsborg, Lokalt, Sverige, Världen, Ekonomi, Sport and Kultur, Mat & Livsstil), but the homepage does **not** render them as separate category blocks.
- `buildMixedHomepageFeed` in `app/page.tsx` interleaves articles from all seven areas into one continuous, date-seeded feed. It keeps the editorial order within each category, avoids consecutive category runs where possible, and includes Elfsborg's full `allArticles` coverage pool. The daily date seed changes the cross-category order without using nondeterministic request-time randomness.
- Category names and article types appear only as discreet article labels. The visible order is a presentation concern: do not move category selection, ranking, article quotas or edition persistence into the homepage component.
- Cards vary between a lead story, standard cards, compact cards and periodic wide image-led stories. Images fill their defined 16:9/16:10 media frame with `object-fit: cover`; the whole lead card owns the two-column layout so the image wrapper cannot leave an empty grey column.
- One **Överblick på 30 sekunder** sits above the feed. It shows up to three numbered takeaways from the existing short AI summaries attached to leading stories, ranked by existing editorial relevance signals and capped at 24 words each. It does not trigger a new AI request. Category-level summaries are not displayed as long paragraphs.
- Local, national, world, sport, market and culture fact panels are inserted as full-width interstitials among the stories. Their components, source adapters, snapshots and cache behavior remain separate from the editorial feed.
- Every article continues to use `TrackableLink` with its original category, type, source, topic and summary metadata. The mixed presentation must not drop an article, duplicate it or change what enters the reader queue.
- If today's edition is unavailable but an older saved edition is valid, the page shows an explicit **Reservedition · inte dagens nyhetsurval** warning with the old edition's date. It does not present those stories as today's news. The user can press **Försök skapa dagens upplaga igen**.
- If today's edition is unavailable and no older valid edition can be shown, the page displays a clear empty/unavailable state with the same recovery action.
- `RetryMorningEditionButton` invokes the explicit server action `retryMorningEdition`. Success reloads the page; failure displays an alert. The recovery action is allowed only in the same Stockholm 06:00–06:59 hour as the Hobby cron publication window.

### Supplemental panels on the homepage

The main page starts the required edition load as soon as the reader profile is ready, while loading optional panels in parallel. Optional-panel failures have fallbacks so a weather or market failure should not prevent the newspaper itself from appearing.

| Visible panel | What it shows | Main implementation |
| --- | --- | --- |
| Väder · Borås | Two-day forecast and precipitation/wind detail. | `lib/weather.ts`, `lib/supplementalCache.ts` |
| Händer i närtid – utvalt för dig | Upcoming Borås-area events, selected/ranked with reading interests; includes a fallback indication when the alternate event source is used. | `LocalSnapshotPanel` in `DailySnapshotPanels.tsx`, `lib/dailySnapshots.ts` |
| På den politiska dagordningen | Planned Riksdag chamber days/items and the latest Riksdag information, with separate empty/error messages. | `NationalSnapshotPanel`, `lib/dailySnapshots.ts` |
| Världsläget i siffror | Latest available market observations and macro indicators including central-bank rates and GDP. Each market item displays its own observation date; Brent is explicitly marked if it lags behind the other market dates. If the world snapshot is stale, the panel warns that it is using the last working snapshot instead of silently presenting a partial refresh as current. | `WorldSnapshotPanel`, `lib/dailySnapshots.ts`, `lib/supplementalCache.ts` |
| Senaste filmrecensionerna | Recent film reviews from DN. | `CultureSnapshotPanel`, `lib/dailySnapshots.ts` |
| Senaste skivrecensionerna | Recent album reviews from DN. | `CultureSnapshotPanel`, `lib/dailySnapshots.ts` |
| Sportdygn | Finished matches from yesterday, selected major matches today, chosen-league standings, top-three scorers and an explanation of the league-table markers. Shows a configuration message when sport data is not connected, source retrieval time for the table, the missing source observation-time limitation, and last-good snapshot status when stale. | `SportDayPanel.tsx`, `lib/sportDay.ts`, `lib/leagueZones.ts`, `lib/supplementalCache.ts` |
| Börsen igår | Stockholm, DAX, S&P 500 and Nasdaq index values/change versus the previous completed trading session. Closed-market data can be correct without representing today's movement. | `MarketDayPanel.tsx`, `lib/marketDay.ts` |

Do not collapse these into one provider-fetching component. Keep visual panels in components and source parsing, cache and last-good-snapshot logic in the existing `lib/` modules.

### Week Focus promotion

A lower-page promotion links to Veckofokus. Its wording and emphasis vary between the weekend and weekdays. The destination itself is only available on Saturday and Sunday; do not mistake the weekday promotion for an enabled Week Focus page.

## 2. Veckofokus — `/veckofokus`

Primary files: `app/veckofokus/page.tsx`, `lib/weekFocus.ts`, `lib/weekFocusCache.ts`, `lib/weekFocusCandidates.ts`, `lib/weekFocusInterests.ts`, `lib/weekFocusQuality.ts`.

- **Saturday/Sunday only.** On weekdays, the page explains that the weekly deep-dive is published Saturday and remains available on Sunday, then links back to the newspaper.
- The weekend edition presents the number of unique articles read in the last seven days, how many topics informed the edition, and how many unread deep dives remain.
- Stories are ranked by topical relevance and editorial/news value, with each story's focus topic and explanation (“Därför är den med”). The personalization status says whether the selection is based on this week's actual reading or whether a fallback ordering is being used because the personal topic picture is not reliable enough.
- Each story uses `WeeklyStoryLink`, so the click joins the same browser reading queue as homepage clicks.
- The user can press **Spara Veckofokus-läsning** to submit queued Week Focus reads. Read-state updates follow the batch/nightly storage flow rather than an immediate per-click write.
- Once no unread stories remain, the page displays **Du är ikapp** and explains that there are no more unread deep dives at that moment.
- The page footer explains that it compares registered Glenn News clicks from the last seven days with articles in saved morning editions. Reads made directly on external sites are not counted unless registered through Glenn News.

Performance contract: one fixed cached weekend edition, keyed to Saturday in the Stockholm timezone. Preserve Saturday precomputation, request coalescing and the weekend cache; do not generate a different edition on every request.

## 3. Profil — `/profil`

Primary file: `app/profil/page.tsx`; data and profile snapshots: `lib/readerProfile.ts`, `lib/weeklyRead.ts`.

The profile page explains that it is shared centrally across devices and is built from reading signals that influence the next morning's selection. Its visible areas are:

- **Summary cards:** total registered article clicks, the strongest category/area, last activity time and the date/time the profile was last updated.
- **Areas and article types:** breakdowns for the categories and kinds of journalism the user opens, with empty-state messages until enough events exist.
- **Semantic interests:** recurring topics derived from background classification of clicked articles, with a short profile/editorial summary. These can be empty until classification has run.
- **Reading over time:** recent 7-day and 30-day activity, a reading streak, and a day-by-day calendar visualization.
- **Favourite sources:** the publishers the user most often opens.
- **Reading rhythm:** the most active time of day and weekday.
- **Topic tags:** themes recovered from classified article content.
- **Entities and geography:** recurring teams, people, organisations and places when classification finds reliable signals.
- **Recent activity:** up to the latest 20 registered events, with timestamp, category, article type/source and topic where available. A linked headline opens the original article.
- **How it works:** a short explanation that opened articles contribute category/type/source/topic signals and that repeated choices influence the morning edition and Week Focus.

The page intentionally shows meaningful empty states rather than pretending that one or two clicks establish a strong preference. A profile can show raw click activity before semantic interest/tag/entity sections have enough classified data.

## 4. Källor / Flödesstatus — `/health`

Primary page/component: `app/health/page.tsx`, `app/components/HealthLogPanel.tsx`. Source-health logic: `lib/feedHealth.ts`, `lib/feedHealthMetrics.ts`; saved statuses: `lib/articleRefreshStatus.ts`, `lib/supplementalRefreshRun.ts`.

### Overview and source table

- The page aggregates counts for all sources, healthy, empty, stale, error, slow responses, average response time and median response time.
- Each source row shows status, source name/URL, category, response time, articles published during the last 24 hours, latest article timestamp/age and a detail string.
- An article source is considered stale when its latest dated article is at least 72 hours old. A slow response is separately marked at 2,500 ms or above; slow is not automatically the same as a broken source.
- The top control requests a new source check after 06:00 Stockholm time. Before 06:00 the page explains the restriction and must not initiate editorial RSS/web fetches.

### Saved refresh status

- **Morgonhämtning** displays the recorded status for the article-cache refresh: status, cached article count, number of source errors, last successful refresh and any explanatory message. Reading this stored status does not itself make RSS calls.
- **Nattlig uppdatering** displays the saved supplemental-job report: last recorded refresh time, refreshed-source count, failures, stale sources, each source's status, last successful time and its error or snapshot-persistence note. The report is written by the Vercel Cron refresh route and viewed without re-running external providers. If both scheduled attempts fail, inspect Vercel Runtime Logs; GitHub Actions remains the manual recovery path.

### Diagnostic logs

`HealthLogPanel.tsx` provides:
- A time-range filter for the last 24 hours or 7 days.
- A level filter for all errors/warnings, errors only or warnings only.
- A manual reload action.
- Summary counters and the commit associated with the diagnostic report.
- Per-entry technical details that can be expanded, a copy action for an individual log, and a copy action for the complete report.
- Clear empty/loading/error states. The rendered report is capped to the latest 80 log entries for the selected period.

Diagnostic events are redacted before being written to Vercel Runtime Logs. Persistent diagnostic history in Blob is intentionally disabled to limit Advanced Blob Operations. When that history is unavailable, the panel must not interpret an empty entry list as proof that no errors occurred; it explains the limitation and points users to the Vercel project. Preserve secret/query redaction and the existing 10-minute best-effort deduplication when adding diagnostic fields.

## Cross-cutting user-visible rules

- **Freshness must be visible.** Never label a previous dated edition as today's news. Preserve the reserved-edition warning and generation timestamp.
- **Partial data is better than a broken page.** Optional panels have explicit empty/error messages and should use last-good snapshots when the fetch layer supports them.
- **Health views must not create hidden work.** Showing saved refresh status must not perform new external requests. Article-source checks remain gated until 06:00 Stockholm time.
- **The reading queue is explicit and batched.** A click queues metadata; the user saves it in batches of up to 50; nightly maintenance updates the ledger/profile. Preserve retryability and idempotency.
- **Week Focus is a weekend product.** Keep Saturday/Sunday gating, the fixed weekend edition and its empty “Du är ikapp” state.
- **Responsive navigation is shared.** When adding a page, update the route map here and decide whether it belongs in `MobileNav.tsx`; retain active-route and keyboard-focus styles.
- **Accessible status messages matter.** Keep `role="alert"`, `role="status"`, disabled states and descriptive labels on asynchronous controls. New error/empty states should tell the user what happened without exposing credentials or raw secrets.

## UI ownership map

| Change request | Start here | Related logic |
| --- | --- | --- |
| Homepage layout, editorial card order or visible edition state | `app/page.tsx` | `lib/dailyEdition.ts`, `lib/editorV2.ts`, `lib/ranker.ts` |
| Supplemental homepage panel UI | `app/components/DailySnapshotPanels.tsx`, `SportDayPanel.tsx`, `MarketDayPanel.tsx` | `lib/dailySnapshots.ts`, `lib/sportDay.ts`, `lib/marketDay.ts`, `lib/weather.ts` |
| Article click tracking/save button | `TrackableLink.tsx`, `WeeklyStoryLink.tsx`, `SaveReadingHistoryButton.tsx` | `readerQueue.ts`, `app/api/events/batch/route.ts`, `lib/readerProfile.ts` |
| Week Focus presentation or story state | `app/veckofokus/page.tsx` | `lib/weekFocus.ts`, `lib/weekFocusCache.ts`, related `weekFocus*.ts` |
| Profile metrics or empty states | `app/profil/page.tsx` | `lib/readerProfile.ts`, `lib/weeklyRead.ts` |
| Source status or diagnostics | `app/health/page.tsx`, `HealthLogPanel.tsx` | `lib/feedHealth.ts`, `lib/feedHealthMetrics.ts`, `lib/diagnosticLog.ts` |
| Navigation, global spacing, metadata or fonts | `app/layout.tsx`, `MobileNav.tsx`, `app/globals.css` | Keep responsive and accessible behavior aligned across all routes. |

## Documentation checklist for future agents

When changing visible UI, update this guide if any of the following changes: route or navigation destination; visible section/panel; button behavior; data freshness/loading/error/empty state; reading-history interaction; responsive behavior; personalization semantics; or diagnostic action. Keep the related architecture/data-refresh documents current too when the change affects storage, fetches, caches or schedules. Prefer documenting actual implementation over intended behavior, and explicitly call out fallbacks and limits.
