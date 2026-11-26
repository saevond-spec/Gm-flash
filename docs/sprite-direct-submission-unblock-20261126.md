# Sprite #1878 — remove obsolete bidding-pipeline blockers (draft, not deployed)

**Updated 2026-11-26. Project scope: Sprite only. Zero additional spend. No customer data or code, credentials, logs, files, prompts or artifacts are transferred into Sprite, Mother, Nova, Star, or any shared project.** No production Worker deployment or authenticated bid was performed as part of this change.

## Confirmed blocker in production v179

Read-only Cloudflare inspection at **07:14 UTC**:
- Scanner: observed 07:10:19 UTC, 160 records, 10 preliminary candidates.
- Autonomous dispatch: observed 07:10:29 UTC, `live_listing_review_scope_and_council_pending`, **attempted=0**.
- Staging probe: 8 reviewed, 0 queued, 1/6 checks passed.
- 18 readiness tables existed, with **no unexpired records**.
- Deployed `dispatchAutonomous()` requires an active `validAutonomousReadiness` row and a **pre-bid** `spriteWorkspaceVerified()` record before its only send path. Its no-readiness fallback only returns `live_listing_review_scope_and_council_pending` and never posts.
- Manual `/api/bid` and `/api/bid-solve` require `confirm_scope_review===true`, a long six-section template and full scope details before POST. This is unnecessary internal staging, but the marketplace still requires a real plan and task-specific feasibility.
- One uncertain existing task #3200 must not be blindly retried; 44 prior receipts remain in the ledger.
- GitHub main is outdated versus exact deployed v179 and is **not** a safe release artifact.

## User-directed revised sequence

```
OFFICIAL MARKETPLACE LISTING
    |
    +--> Fresh authenticated Sprite #1878 identity + original public task detail
    +--> Exclude known simulations and own existing/reserved/uncertain bids
    +--> Basic public task fit, real deliverability and explicit non-simulation evidence
    +--> Quote ($20–$1,000 live connector cap), deadline, clear public-only buyer plan,
         buyer message and verification approach; zero additional spend
    |                       (no 18-table readiness, no Council veto,
    |                        no pre-award customer workspace, no exhaustive
    |                        acceptance-mapping/formal scope signoff)
    |
    +--> ATOMIC EXISTING reserveThenScan / submitWithReservation single POST
    +--> Independent authenticated bid receipt: exact Sprite agent, task, amount, bid ID
    |                        (unknown/mismatch => DO NOT RETRY)
    |
    +--> IF AWARDED: independently provision dedicated per-job customer sandbox
         and verify complete buyer scope and all acceptance criteria;
         check genuine escrow funding before delivery; no customer material
         crosses out of that sandbox.
```

This retains an essential **brief pre-bid feasibility check**, because bids must accurately state what Sprite can deliver. **Full scope review and customer workspace attestation occur after award.** Approval by Mother or Nova is *not a prerequisite to bidding*, and no customer data may be sent to those agents.

## Code added (Sprite-only draft branch)

- `sprite-direct-prebid.mjs`: pure decision function. Eliminates `archived_readiness_row`, `council_vote`, `prebid_workspace_attestation` and `prebid_scope_mapping` requirements. Keeps true identity, task authenticity, capability, quote, deadline, buyer plan and own bid history.
- `sprite-direct-bid-orchestrator.mjs`: trusted-dependency interface for approved agent/task reads, authoritative bid history, per-job-isolated *public-only* proposal preparation, one atomic reservation/send and independent matching receipt readback. Never reads secrets or calls another agent itself. Does not forward full task objects or attachments to the proposal helper.
- `tests/sprite-direct-prebid.test.mjs`: 34 fictional-data cases.
- `tests/sprite-direct-bid-orchestrator.test.mjs`: 29 fictional-data cases.
- Earlier scheduler, post-award scope, funding-authenticity and simulation/duplicate scan modules remain unchanged.

**These are integration components, not a working deployed replacement.** Their production dependencies must be mapped only to the authorized Sprite Worker, and the actual `reserveAndSendOnce` implementation must be the currently deployed atomic routine with unique per-task reservation.

## Mandatory production integration and checks

1. Retrieve the **exact** live v179 script and 39-module metadata privately in the Sprite-only environment; perform secret/customer-content scan, source-integrity check and dry-run diff. Do not upload production source into the public repository, or overwrite v179 with stale main.
2. Integrate the authenticated direct path into the live `dispatchAutonomous()` no-readiness fallback in place of its permanent `live_listing_review_scope_and_council_pending` return. Retain per-task reservation, identity, simulation, price, deadline, truthful capability, zero spend and receipt checks.
3. Simplify protected `/api/bid` / `/api/bid-solve` to allow an accurate, substantive proposal without the unrelated pre-award full scope certificate; preserve the existing private `x-control-token`, `PLACE_BID`, official marketplace authentication, unique reservation and readback. Test manual and autonomous paths separately.
4. Never claim a bid is submitted merely from HTTP 200 or a heartbeat. Verify the bid's authenticated marketplace record (agent 1878, matching task, amount, bid ID, state).
5. In a safely staged deployment with rollback, start with **one eligible** non-simulated task, then expand gradually to the user's 20-bid objective only after confirmed receipts and no duplicate/cross-customer leakage.
6. Do not broaden AI/council access to private customer materials. Dedicated customer environment must be created and verified **after award and before any customer work**.
7. Do not fabricate job authenticity: the current stored market inventory mostly has `simulated=NULL`. Authenticated task/detail evidence must be obtained before any bid. ClawHunt permits no-escrow bids, but requires checking funded escrow before work after selection.

## Marketplace reference

ClawHunt official: https://clawhunt.store/for-agents/openclaw . A bid is a fixed price, approach and estimated time. One bid per task; no SDK or Council approval is required by ClawHunt. Simulated bounties have no real funds. The fixed quote may be revised, not duplicated.

**Current truth:** these blockers are removed from *draft source*, not live production. No new bid, accepted assignment, official score, customer material transfer or payment is claimed.
