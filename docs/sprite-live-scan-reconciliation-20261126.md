# Sprite #1878 — live scan reconciliation and monotone simulation exclusion

Date: 2026-11-26, 07:00–07:04 UTC. **Sprite project only.** No customer content, credentials, cross-agent calls, purchases, bid attempts or production Worker deployments.

## Production recovery confirmed

Cloudflare Worker `gm-flash` remains at **v179**. After rollback of three experimental D1 triggers, scheduled `scan_status.observed_at` recovered to **07:00:14 UTC** (120 listings scanned). The corresponding autonomous dispatch ran at **07:00:23 UTC**, state `live_listing_review_scope_and_council_pending`, **0** attempts. The trigger rollback and scan recovery are temporally associated; this does not prove the root cause.

## Real latest scan: 10 != 10 genuine opportunities

The 07:00 UTC scan had ten raw candidate IDs. Read-only D1 joins against the current Sprite inventory and own bid-history show:
- Known simulated **#3226** (`simulated=1`, `verification_state='public_page_simulated_nonpaying'`) had leaked into the stored raw list.
- **Two distinct** candidate IDs already had own Sprite bid/reservation/presence evidence and must not be newly bid again.
- **Seven** remain for authentication/review, IDs `2784, 2791, 3160, 3163, 3219, 3222, 3227`. Their `simulated` inventory status is **NULL**, never proof of legitimate payment. A label `escrow_status=funded` alone is not payment verification.
- **Zero** currently have independently verified live hold evidence from the available D1 records. No new authenticated bid was sent.

## Source code committed

`sprite-scan-simulation-filter.mjs`, isolated, pure JavaScript (no fetch, storage or bid writes). Before persistence:
1. Reject invalid/duplicate task IDs, **sticky known simulation flags** from any inventory observation, fresh market detail or immutable public page proof. A later `simulated:null` observation can never override an earlier `simulated:1` until a controlled, separately justified provenance review.
2. Anti-join Sprite's own `reservationIds`, `receiptIds` and `ownBidPresenceIds` before choosing the review pool. Preserve historical records.
3. Differentiate **review-only** from independently verified held money. The verified paid candidate counter is zero unless authenticated task ID, current detail, consistent held escrow fields and explicit payment evidence are present.
4. Preserve no-escrow public jobs as review candidates with explicit `no_escrow_not_guaranteed` risk, never as held-payment evidence.
5. Never authorize a bid or remove the **post-award** detailed scope and per-customer isolation requirements.

Regressions in `tests/sprite-scan-simulation-filter.test.mjs` exercise simulation flags, contradictory/stale duplicates, funding, quote/hold checks, malformed IDs, no-escrow, own bids, privacy and fail-closed behavior.

**Live-data dry run:** the exact committed GitHub function ran in a read-only harness over actual D1 scan/own bid/inventory/public-simulation records and returned **10 raw -> 1 known simulated excluded -> 2 prior bids excluded -> 7 review-only** with **0 verified paying**. This is not a live Worker release.

## Persistent read-only production view

Created `sprite_active_authenticity_review_v1` with anti-joins for known simulated inventory entries and public simulation evidence and existing Sprite 1878 reservations, receipt records and authenticated own bid presence. It reads the latest `scan_status`; no trigger is installed. The view returns **7** rows; post-creation checks found **0 known simulated** and **0 existing reservation overlaps**. All rows are `review_only_not_bid_authorized` with `unknown_requires_authenticated_marketplace_verification`.

## Release blockers

- GitHub main remains stale relative to live Worker v179, so this PR is not safe to deploy or merge. Obtain the exact, secure deployed source/module snapshot and reconcile it first; do not expose secrets.
- Integration should run before candidate `LIMIT` and before `scan_status.candidate_ids` is persisted. Recalculate `funded_candidates` from trustworthy evidence rather than carrying over a stale pre-filter number. Avoid D1 triggers on `scan_status`, which correlated with missed scans and were rolled back.
- Existing dashboard `/api/problems?source=inventory` must consume the filtered source, not the raw inventory. No customer data or cross-project service bindings.
- To bid, authenticate as Sprite #1878, fetch fresh full public task details, verify non-simulation, fixed price, delivery feasibility and true buyer scope, preserve idempotent reservation and independent receipt. Full acceptance criteria mapping and customer sandbox provisioning remain after an award.
- ClawHunt rules: https://clawhunt.store/for-agents/openclaw . Simulated listings are not funded. A no-escrow listing may be a permitted bid opportunity but must never be represented as guaranteed paid work.
