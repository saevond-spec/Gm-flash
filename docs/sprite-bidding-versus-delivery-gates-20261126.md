# Sprite #1878 — distinction between bidding and delivery requirements

Date: 2026-11-26, 08:18 UTC. Sprite-only. No customer content, credentials or cross-project materials used.

## User-directed change

There is **no ClawHunt API requirement** that Blender 5.0.0 already be installed or that a human supervisor already have executed a real guidance session merely to transmit a bid. The buyer's full technical deliverables are verified **before delivery**, not as proof-of-installation attached to the HTTP bid request.

- Removed the special Blender/human-attestation pre-bid blocking branch in `sprite-direct-bid-orchestrator.mjs`. The after-award evidence checker `sprite-blender-readiness.mjs` remains available for fulfillment validation.
- The direct bidder still requires a **truthful, feasible, specific public-brief proposal** (`capability_verified`, `can_deliver_public_brief`), fresh authenticated Sprite 1878 identity and listing, real/non-simulated evidence, acceptable quote, zero additional spend, verified no-duplicate status, and atomic one-shot submission with exact authenticated receipt.
- It never treats a promise to find Blender/experts later as evidence those resources already exist. If Sprite cannot truthfully commit to meeting the buyer's requirements in the promised timeframe, the general delivery feasibility check still holds; no fictional human guidance, Blender renders, model versions or proof are permitted.
- All customer delivery and client-specific materials remain in a separate dedicated per-customer/per-job execution environment, **outside Sprite and all other agent projects**.
- The exact-source integration tests were updated to prove that specialist tooling is **not** itself a pre-bid protocol prerequisite while explicitly unverified delivery capability still holds. Full fetched-source combined regression run: **225/225 passed** (23 scheduler, 22 acceptance, 30 marketplace evidence, 32 simulation filtering, 39 direct prebid, 23 post-award Blender, 33 bidder, 17 operator queue, 6 integration tests).

## Live Sprite D1 state

Updated only task #4188 from `deferred_missing_blender_and_human_expert` to `prebid_auth_and_truthful_plan_pending`, and review hold reason from `operator_deferred_no_blender_or_human_expert` to `await_auth_bid_route_and_truthful_delivery_plan`. Kept `bid_ready=0`. This is an accurate classification, not a manufactured capability certification or marketplace bid.

Latest verification (08:17 UTC): `gm-flash` Worker **v179 unchanged**, scanner alive (150 records at 08:15), autonomous dispatcher `live_listing_review_scope_and_council_pending`, attempted=0. For #4188: **0 queued operator commands**, **0 reservations**, **0 authenticated bid receipts**.

## Remaining production work (NOT completed)

The current Worker v179 does not yet import the new direct operator queue module. It includes **55 modules** and seven bindings. Do not deploy GitHub's stale `main` as a replacement; direct bid integration requires a reconciled, staged and rollback-tested production Worker using its existing authenticated ClawHunt secret internally. Do not copy that secret to the operator, another agent or a browser. User specifically requested **Sprite direct**, not TinyFish/browser.

When an authorized direct route is available, only submit a job Sprite can truthfully deliver with a specific offer. A buyer can decline a proposal, and buyer selection may impose a 72-hour delivery obligation; do not fabricate fulfillment resources or guarantee work that cannot be done. ClawHunt guide: https://clawhunt.store/for-agents/openclaw .

**Do not claim #4188 is submitted.** Nothing in this change posts an authenticated ClawHunt bid or creates its receipt.
