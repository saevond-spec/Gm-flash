# Sprite #1878 — direct Cloudflare D1 bid channel and truthful Blender readiness

Date: 2026-11-26. **Exact production Worker remains v179.** Do not merge the stale-based PR or deploy these components as if they are already connected.

## Confirmed production facts (real, 07:52 UTC)

- Cloudflare `gm-flash` remains deployed as v179. Exact `/content/v2` response is a ~684KB multipart script with **55 source modules**, not a single copy of GitHub `main`; 7 bindings remain, including AI, D1, same-project bid sandbox, CONTROL_TOKEN and CPH_API_KEY as Cloudflare `secret_text`.
- Scheduled handler is `spriteWorker.scheduled(event,env,ctx)` and already dispatches one read/scan cycle every five minutes. This is the correct eventual hook for a private management-authenticated operator queue.
- Current direct `/api/bid` requires the `x-control-token` secret and ClawHunt `CPH_API_KEY` internally. **Cloudflare management APIs cannot invoke this protected route for ChatGPT**, and secrets should not be exported or pasted to solve it.
- New **empty** D1 table `sprite_operator_bid_requests_v1` created successfully in production with `agent_id=1878`, exact task ID, fixed dollar ceiling, 24h expiration and one-row-per-task non-repeat constraints. A count after creation was **0**; no actual bids were queued or sent.
- Scheduled scan continued at 07:50:14 UTC after table creation (160 records, 0 bids), with no regression in observed receipt count (44). The three prior problematic D1 triggers remain absent.
- #4188 has no reservation or receipt. Its public brief requires exact Blender 5.0.0, genuine independent human expert guidance, a particular Codex GPT model, at least five rounds, three native 4K renders, licensed references, and an encrypted multi-volume evidence package. Do not claim ready until every essential ability is evidenced.

## Sources added to this PR

1. `sprite-direct-operator-queue.sql` — migration already created in production without data. No customer content.
2. `sprite-direct-operator-queue.mjs` — future Worker-side one-shot claim, 24h expiry, no retry after uncertainty, no automatic bypass.
3. `sprite-direct-prebid.mjs` — direct, fresh authenticated task and operator-quote check. Accepts positive escrow proof (`bounty_type=escrowed`, matching amount, `escrow_funded=true`, `payment_evidence=funded_escrow`) even when API omits `simulated=false`; a conflicting explicit simulation warning always blocks. No archived readiness-table, mandatory council vote, full scope mapping or pre-award workspace.
4. `sprite-direct-bid-orchestrator.mjs` — proposed only-one-send operation with existing reservation and independent bid receipt; rejects unverified human-guided Blender work. The isolated proposal generator receives only a task ID, never the raw task object or buyer/customer attachments.
5. `sprite-blender-readiness.mjs` — evidence gate for exact native Blender 5.0.0, native 4K output, requested model execution, real human expert scheduling, five-round capture capabilities, licensed materials and zero added spend.
6. Integration tests `tests/sprite-direct-queue-integration.test.mjs` run the actual queue + actual direct bidder with mocked external dependencies, demonstrating a credible non-Blender task can pass and a Blender job without evidence holds before attempting POST.

## Production integration (not yet done)

- Download the exact current **55-module** production version, not stale GitHub `main`.
- Before submitting a new Worker version, privately inspect each module and its import graph for cross-project/customer data. Do not expose source, credentials, logs or customer content in a public branch.
- In the v179 scheduled handler, call `consumeSpriteOperatorBidQueue` using the existing Sprite D1 binding **only after** binding trusted adapters to `spriteMetadata`, `autoRequest`, per-job isolated public-only proposal generation, existing `submitWithReservation` / `reserveThenScan`, and authenticated own-bid receipt readback.
- All adapters must default to **hold** if any identity, escrow, conflict, customer isolation, capability, proposal or receipt proof is unavailable. `max_authorized_quote_cents` must be enforced at final proposal freeze.
- Keep `/api/bid` and its `x-control-token` protection intact; do not expose a public direct queue insert endpoint. Only authorized Cloudflare D1 management can enqueue. Never copy `CONTROL_TOKEN` or `CPH_API_KEY` to ChatGPT, GitHub, another agent or a different project.
- Stage a separate non-deployed Worker version with original 55 modules and inherited secret bindings. Review the staged diff and run actual integration/rollback security checks before production deployment. Do not deploy with stubbed or hard-coded identity/proofs; do not run simulated listing data as production.
- Verify one eligible, deliverable job with one authenticated ClawHunt receipt before attempting multiple bids. Uncertain #3200 is a **different task**, must not be retried without authoritative own-outcome reconciliation.
- Full scope review, customer-private sandbox and delivery occur **after award**. Customer content remains outside Sprite's shared components.

## Current result / limitations

The **private operator request table exists**; the Worker is **not yet consuming it**, so the secure direct submission bridge is **not production-active**. #4188 has **no verified independent human expert, exact requested Codex model execution, or operational Blender render runner** in the connected Sprite environment. Removing a blacklist is not evidence of that capability. No successful bid or receipt is claimed.

Roll back the empty queue schema only after verifying no pending requests:
```sql
DROP TABLE IF EXISTS sprite_operator_bid_requests_v1;
```
