# Glenn News â€” UI and feature guide

This is the source-oriented handbook for the **user-visible interface**. It records what each page currently does, which interactions exist, where the behavior is implemented, and which contracts future agents must preserve. Keep it aligned with the code whenever a route, component, label, user interaction, empty state, or navigation flow changes.

For data-source schedules and cache lifetime, read [Data refresh inventory](data-refresh-inventory.md). For the main code/data-flow map, read [Architecture](architecture.md). Contributor workflow and production invariants are in [AGENTS.md](../AGENTS.md).

The homepage sport panel and supplemental panel footers display the snapshot fetch date/time in the Stockholm timezone. The sport table also shows when Glenn News retrieved the table response and explicitly states that FotMob does not expose a distinct observation timestamp in the consumed payload. A stale sport snapshot shows its last saved time and explanatory status. The market panel displays each market's actual trading-session date separately from snapshot fetch time; these may differ because of weekends, holidays or source availability.

The local BorÃ¥s calendar reads active entries from the long-lived BorÃ¥s.com catalog when at least six upcoming entries are available. It keeps the existing interest ranking and separate municipality-meeting list. Explicitly cancelled events are removed from the visible selection immediately; events a¶»§q«^