# Glenn News — small, continuous improvements

## Source of truth

- [Issue #52](https://github.com/brunofogaca-glenn/glenn-news/issues/52) is the short active-work queue. Keep no more than three active priorities there.
- Individual GitHub issues own one deliverable each.
- [product-requirements.md](product-requirements.md) defines intended product behaviour and invariants.
- [architecture.md](architecture.md), [ui-feature-guide.md](ui-feature-guide.md), and [data-refresh-inventory.md](data-refresh-inventory.md) document only the areas a change actually affects.
- [AGENTS.md](../AGENTS.md) defines repository implementation and validation rules.

Do not copy full backlogs, acceptance criteria, or long status histories into #52. Link to the owning issues instead.

## The size rule

Every issue selected for implementation must describe **one observable outcome** that can be completed in one focused PR.

Use this sizing before starting:

| Size | Guide | Decision |
| --- | --- | --- |
| XS | One small change, usually 1–2 files | Ready |
| S | One behaviour or one narrow bug, usually 3–5 files | Preferred |
| M | One vertical slice, 6–8 files or more than one layer | Ready only with a short reason why it cannot be smaller |
| L | More than 8 files, multiple independent behaviours, or several separately verifiable outcomes | Not ready: split before coding |

File counts are a warning signal, not a goal or an absolute limit. A vertical slice may legitimately touch UI, API, storage and tests. Do not split a coherent slice into PRs that cannot work independently.

A task is too large when it:
- changes more than one independent user-visible or operational behaviour;
- mixes implementation with an unrelated refactor, test-suite redesign, or documentation cleanup;
- has more than five acceptance checks that can pass or fail independently;
- cannot be described in one sentence without using “and” repeatedly.

When an issue is too large, keep it as an EPIC/parent only if there are at least two genuinely independent deliverables. Create small child issues, each with its own result and acceptance checks. Otherwise rewrite the issue as the first thin slice and move later ideas back to the backlog.

## Issue template

Use one of these types in the title/body:

- **BUG** — one broken behaviour, with reproduction/evidence and expected result.
- **TASK** — one small implementation or investigation.
- **VERIFY** — one production behaviour to confirm after a release.
- **EPIC** — parent for two or more independently deliverable child issues; never a coding ticket itself.

Every implementation issue should contain:
1. **Outcome:** one sentence describing what will be different.
2. **Scope:** what is included and what is explicitly excluded.
3. **Done when:** usually 2–5 observable checks.
4. **Risk guardrails:** only the relevant invariants.

Do not add speculative acceptance criteria for future phases. Do not create an issue for a possibility that has not been triaged.

## PR rules

- One active PR per coherent issue/workstream.
- One PR has one purpose. Include only the tests and documentation needed for that purpose.
- Aim for 1–5 changed files. 6–8 needs a brief explanation. More than 8 requires splitting or an explicit explanation of why a single vertical slice is safer.
- Do not add unrelated cleanup, broad test rewrites, or “while here” improvements.
- Before merge: inspect the full diff, run the relevant regression tests, verify GitHub CI on the exact head SHA, and check the Vercel preview when the app build is affected.
- A READY preview, a Vercel status check, or an old green Actions run does not prove current GitHub CI.
- Avoid repeated builds/deployments for intermediate edits. Do not push directly to main unless explicitly requested.

## Verification rules

A VERIFY issue must describe one thing to check, not hold a combined list of unrelated follow-ups.

- State the exact production signal, data field, route, page or user action to inspect.
- State what success looks like and what must not be changed during the check.
- Do not use production data mutations or manual Cron runs unless explicitly approved and safely controlled.
- If verification depends on a future scheduled run, mark it **waiting for next scheduled run**, record the relevant deployment/commit and next check, then return to other work. Do not keep a developer task open just to wait.
- Close the VERIFY issue immediately after the stated check passes. If it fails, open one small BUG for the observed failure and close/replace the VERIFY issue as appropriate.
- Never describe “fixed in code”, “merged”, “deployed” and “verified in production” as the same status.

## Working cadence

1. Check #52 and the active PR before starting. Do not create duplicate issues or parallel PRs.
2. Pick the highest-priority ready issue. If it is L-sized, split it before coding.
3. Inspect only the relevant requirement, owning module, closest test and current production evidence.
4. Make one complete, narrow change and add the smallest regression test that would have caught the problem.
5. Update only documentation affected by the behaviour or invariant change.
6. Review diff and exact-SHA checks once. Fix failures; do not repeatedly rerun successful checks without a relevant edit.
7. Update the owning issue and #52 with evidence, uncertainty and the next single action.
8. Move on. Do not grow the current PR to absorb newly discovered unrelated work.

## Priorities

- **P0:** security, privacy, data loss or central service unavailable.
- **P1:** morning edition or a core reader flow is broken or misleading.
- **P2:** a contained feature or recurring defect with clear user value.
- **P3:** polish and optional future ideas.

Priority does not override size. Split a P1 into small safe deliveries rather than creating one large emergency PR.

## Permanent guardrails

- No Blob writes per click, article or render. Preserve bounded batch writes and existing cost ceilings.
- Preserve private paths, idempotency, 01:00–05:59 Europe/Stockholm write windows, authentication and last-good data.
- Never replace valid history/snapshots with empty data after transient read or parse errors.
- Preserve editorial source gating and existing cache/coalescing behaviour.
- No additional AI calls, upstream calls, Blob operations, paid observability products or schedule changes without a separate justified decision.
- Documentation must describe verified behaviour, not intended behaviour.

## Current work

The live status and next three priorities are maintained only in [Issue #52](https://github.com/brunofogaca-glenn/glenn-news/issues/52). Do not maintain a second dated status register in this file.