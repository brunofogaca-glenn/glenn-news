# Glenn News — test strategy

## Purpose

Regression tests must prove observable behavior and important data-integrity guarantees. A green build or a source-code string check is not evidence that a complete user flow works.

## Test layers

1. **Unit tests:** deterministic rules with narrow inputs, such as ranking weights, date boundaries and URL normalization.
2. **Integration tests:** real application modules wired together with controlled external boundaries. Use in-memory Blob/RSS/browser substitutes and inject failures at those boundaries.
3. **End-to-end tests:** production-like user journeys across routes and rendered UI. Add these where a stable test environment can exercise the real application without production writes.

Keep fast unit tests for complex pure logic. Prefer fewer scenario tests for critical workflows over many assertions about implementation details.

## Critical scenarios to protect

| Flow | Required proof |
| --- | --- |
| Morning edition | One failed RSS provider does not prevent valid providers from contributing; the published edition is valid and readable |
| Editorial selection | Valid stories survive normalization, deduplication and ranking; irrelevant or stale stories are excluded |
| Borås events | Incomplete/undersized scrapes preserve last-good data; complete scrapes merge, normalize, cancel and archive events safely |
| Reading history | A valid batch is persisted once, retries are idempotent, and transient/malformed Blob reads never overwrite existing history |
| Night jobs | Each job reports its own failure; retries and repeated invocations do not duplicate writes or corrupt snapshots |
| User experience | Homepage and Week Focus render the saved data and graceful empty/error states at mobile and tablet breakpoints |

## Failure injection

At least one integration scenario per critical storage/source flow must inject each relevant failure:
- HTTP 5xx and request timeout
- invalid or incomplete provider payload
- Blob read failure, malformed JSON and missing object
- duplicate delivery/retry
- partial browser scrape or missing pagination metadata

Assertions must cover both the failure result and preservation of last-known-good data. Tests must not call production APIs or write production Blob objects.

## Consolidation rules

- Do not delete an existing regression test until its meaningful behavior is covered by a stronger test.
- Remove tests that only assert source-code strings when a behavioral test covers the same contract.
- Keep tests for small high-risk pure rules where they are clearer and cheaper than a larger scenario.
- Name tests after the behavior and failure condition, not the implementation function.
- A new critical PBI must add or update a behavioral regression test.

## Current implementation

The first critical-flow suite is `tests/critical-data-flow.integration.test.cjs`. It exercises the real Borås catalog merge and weekly-read storage modules with controlled in-memory boundaries. It currently covers incomplete/undersized scrapes, URL normalization, omission/cancellation/reappearance behavior, missing Blob snapshots, deduplication, transient read failures and malformed data.

The suite is included in `npm run test:refresh` and therefore in the normal `npm run build` test gate. The remaining existing suites are retained until equivalent behavioral coverage replaces their useful assertions.
