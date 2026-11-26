# Sprite #1878: candidate scheduler review patch (NOT DEPLOYED)

**Scope:** This patch contains only generic public-task metadata selection code and fictional tests. It does not read customer materials, credentials, other agent services, or commit any actual buyer proposal.

## Evidence, November 26, 2026
- Production Cloudflare `gm-flash` is v179, with a 5-minute scan cadence and 0 newly submitted bids in the sampled dispatches.
- Production D1 showed 611+ prior `unsupported_scope` holds, no currently valid readiness rows, 44 historical receipts and one uncertain task #3200.
- A read-only candidate query on the real indexed marketplace found many unbid, recent, previously unreviewed listings, including data jobs. Those are *review candidates*, not deliverable or bid-ready jobs.
- GitHub `main:worker.mjs` is stale versus the deployed source. **DO NOT DEPLOY THIS BRANCH OR MERGE THE PR AS A PRODUCTION FIX.**

## Mathematical change
Instead of `limit(top discovered records) -> exclude blocked rows`, implement `exclude invalid/duplicate/stale/reserved/known simulated/cooldown rows -> rank eligible review pool -> take limit`. Fair per-category round robin prevents a repeated category from monopolizing review slots. No ungrounded win-probability estimates are calculated. The module's outputs are always `review_required` and `bid_ready:false`.

`assessBidStageEvidence()` models *bid-stage* evidence: lightweight public-scope feasibility screen (not a full review), independently demonstrated capability, accurate quote, no extra spend, Sprite identity, authorization and no uncertain duplicate. It intentionally does not require a *pre-bid* workspace certificate; an independent customer workspace remains mandatory before accessing customer data or beginning delivery.

## Security and release gates
1. Recover and review the **exact** deployed v179 snapshot and its module set in a separate Sprite-only private development environment, with source/secret scanning and signed-off rollback. Never overwrite the live Worker with stale `main`.
2. Incorporate this selector only into public candidate discovery. Before bidding, validate open/non-simulated listing, basic public scope feasibility, demonstrated capability, trustworthy price/deadline, accurate proposal, identity and duplicate prevention. Defer exhaustive acceptance-criterion mapping and detailed scope review until **after a verified award to Sprite**, and only within that customer's independently isolated workspace. Stop delivery if the full scope cannot be met; ask the buyer to resolve it rather than making false commitments.
3. Preserve authorized Sprite #1878 key, immutable quote and proposal, unique per-task reservation, uncertain-bid quarantine, Cloudflare subrequest headroom and **independent authenticated receipt**.
4. Never call unrelated agent service bindings or touch customer environments from this review module.
5. After an authorized release, confirm one genuine new bid and post-POST read-back (task, Sprite agent, bid ID, amount, status and timestamp) before increasing volume to 20. A heartbeat is not a receipt.

## Local tests
Run `node --test tests/sprite-review-queue.test.mjs` using Node 20+. The review scheduler and award-stage scope review have separate fictional-data tests are fictional, not an official ClawHunt benchmark or proof of deployment.

## Marketplace reference
ClawHunt official https://clawhunt.store/for-agents states agents should bid on only what they can finish, with a fixed price and an approach. Bid API: `POST /api/v1/problems/{problem_id}/bid`. No speculative customer-data access or fake capabilities.

## Scope-review placement — requested 2026-11-26

- **Before bid:** only basic evidence of a genuinely biddable task and that Sprite can credibly perform the publicly described work; do not require full acceptance mapping or a customer workspace. Never bid blindly on jobs known to be out of capability.
- **After award:** verify the accepted task is awarded to Sprite, provision and attest a dedicated per-job customer workspace, examine the complete buyer scope, map each acceptance criterion to a deliverable and verification method, confirm feasibility and deadlines, and then authorize starting delivery (with separate semantic approval). No customer data may be loaded outside the isolated workspace.
- This is a **draft GitHub-only change**. The deployed Worker v179 still has redundant pre-bid scope/workspace checks. An authorized source reconciliation and production release are still needed.
