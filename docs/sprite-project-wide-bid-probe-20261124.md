# Sprite #1878 — project-wide bidding fault investigation (2026-11-24)

**Scope:** only `saevond-spec/Gm-flash` and Sprite's own Cloudflare services/database. No Star code, credentials, customer files, logs, or deployment were accessed or transferred. Public ClawHunt task requirements were read in memory for eligibility/acceptance probing, never persisted to Sprite D1.

## Grounded production observations
- Deployed Worker: `gm-flash`, 21 modules, main code materially differs from GitHub `main`; draft PR #19 restores the production-equivalent source.
- Production D1 `7c7ad5f1-0aa5-43f5-ae4f-2bffd9bfe134`: 0 rows in `autonomous_readiness`, 0 autonomous signatures, 0 Sprite bid receipts. Historical task `#3298` is in `uncertain` state; never resubmit it without authoritative bid reconciliation.
- At 2026-11-24 18:31 UTC the scheduled scan had 33 records and 0 eligible funded candidates. Several task details had funded escrow but no verified price under the older production price parser. Its most recent dispatch was `live_listing_review_price_unknown` for task #4200, zero actual POST attempts.
- Verified current public ClawHunt examples: task #3310 is listed `bidding` but has a **2026-11-23 15:59:59 deadline**, now expired; #3257 and #3256 have 2026-12-21 deadlines. Status alone cannot authorize a bid.
- PR #21 is stacked onto draft PR #19, not directly onto the obsolete `main` branch.

## Root causes and changes made in draft PR #21
1. **Unreachable Mother/Nova veto:** both issuers use v1 eleven-field intent, unauthenticated /api/v1/problems GET (401), nonexistent `budget_cents`, and unconditional `independent_scope_and_delivery_proof_required`. Sprite expected v2 signatures. Fixed by retiring the obsolete *mandatory* cryptographic approvals for an explicitly operator-authorized, Sprite-only delegated path. Mother/Nova review remains advisory. This does not loosen marketplace identity or bid ownership rules.
2. **Unqualified task discovery:** scanner finds records but never turns them into independently vetted `autonomous_readiness` rows. This still blocks real autonomous sends. No fictional rehearsal or category is treated as proof of buyer deliverability.
3. **Generic bid proposals:** prior AI builder received mainly numeric metadata and compressed the entire proposal into roughly 1,000 characters. Added transient extraction of public task scope, deliverables, and all 1–16 numbered acceptance criteria; autonomous drafts require one distinct plan+evidence mapping per criterion, exact pricing/ETA, and no prompt-injection phrases. Proposal cap is ClawHunt's documented 5,000 characters; buyer message cap is 1,000. Task descriptions and buyer requirements are not written to the control-plane DB.
4. **Hardcoded confusing statuses:** retire the false signer-required messages, keep health `auto_bidding=false` until work is actually executable, separately surface policy-enabled status and readiness blockers.
5. **Ambiguous transport after reservation:** journal `reserved -> submitting` before network POST, then `submitted` only with matching authenticated receipt (task, Sprite agent #1878, amount); otherwise `uncertain` and never automatically retry. Historical #3298 stays untouched.
6. **Financial bounds:** 25,000 seeded deterministic price-floor/amount/deadline cases now assert delegated authorization holds outside operator minimum ($20), quote ceiling, platform budget/floor, or posted deadline.

## Probes actually run (not live bids)
- GitHub isolated integration workflow: **140/140 tests passed**, including a 25,000-case mathematical quote/deadline matrix, a 1,000-case missing-acceptance test, signed payload tampering and one-send regression tests. See PR #21 checks.
- Cloudflare **isolated Sprite staging D1**, database `sprite-council-sandbox`: 32 concurrent reservation attempts -> exactly 1 winner, 0 errors, 0 accepted duplicates; confirmed receipt path -> CONFIRMED, unknown path -> UNKNOWN; illegal UNKNOWN->SUBMITTING returns zero rows; `PRAGMA quick_check=ok`. Synthetic problem IDs only: **no marketplace POST**.
- Public API task probes: all 4 criteria of #3310, all 3 of #3257, all 3 of #3256 can be structurally extracted, with exact public scopes and deliverables. #3310's deadline mismatch was identified before a new Sprite bid.

## Remaining blockers, in priority order
1. **Fresh task-specific readiness** is zero. Need to actually prove Sprite can deliver a selected task's complete scope in a dedicated isolated job environment, not merely run arbitrary CSV/arithmetic fixtures. Until then, do not mint `scope_verified=1` or `isolated_environment_verified=1` without evidence.
2. **Credential/standing checks:** verify current `/api/v1/me` is Sprite #1878, approved, has the Bid scope, heartbeat and capacity standing, not Star #1744 or any other agent. Never export credentials into GitHub, logs or ChatGPT.
3. **Production-equivalent staged Worker:** test exact 21 modules, bindings, D1 batch receipt processing, and concurrent send/reservation before deploying. This PR has no production Worker deployment.
4. **Live canary:** after independent readiness, send ONE authenticated Sprite bid to a distinct still-open task, confirm exact receipt ID, agent, amount, and AwwO review. Only then scale to multiple simultaneous tasks; never submit duplicates or blindly retry #3298.
5. **Post-award delivery capability:** the currently verified `csv_cleanup` and `arithmetic_reconciliation` rehearsal profiles do not independently qualify advanced Blender or UAT documentation jobs. Build an actually testable delivery profile before allowing those jobs.

## Safety/integrity
- $0 additional spend, free-tier only. No new secret, wallet authority, or contract signing.
- Customer files, credentials and deliverables remain in the customer-specific environment; no cross-project copies.
- Strongly prefer fewer exact first-pass proposals over high-volume generic bids.
- **No Sprite live bid was submitted in this investigation. No production deployment occurred.** Star's previous ClawHunt bid #37801 is separate and was not altered.
