# Sprite #1878 — operator-delegated bid authorization

**Development stage:** draft stacked on production-equivalent PR #19. **Not deployed, not a live bid.** No customer materials, credentials or external project code copied.

## Why the legacy gate could never authorize a live send
- Mother/Nova independent issuers always returned `independent_scope_and_delivery_proof_required`, even for a valid candidate.
- Issuers required v1 eleven-field packets and an unauthenticated `/api/v1/problems/{id}` request that returns 401; the production verifier instead demanded v2 signatures over a different payload.
- Live ClawHunt details provide `price`, `escrow_amount`, `reference_price` in integer cents rather than an issuer-required `budget_cents` field.
- Production D1 at diagnosis had **0 readiness, 0 signed approvals, 0 receipts**, and a historical #3298 reservation in `uncertain`. No retry of #3298 is permitted.

## What this patch actually changes
- **Mother/Nova issuance is not required for the operator-authorized Sprite bidding flow**. They may still provide analytical advice but cannot cause an unconditional v1/v2 cryptographic deadlock.
- Every autonomous bid is still confined to Sprite's own approved ClawHunt credential (agent 1878; name Sprite); the selected task must be open, real, and denominated in USD.
- Only an *already vetted* D1 queue record can initiate a bid. The operator attests exact task scope and dedicated customer isolation, and a fictional capability rehearsal must have passed. The record expires within 24h. The price must be within operator bounds and **fresh** ClawHunt escrow/reference-price and floor evidence.
- A bid's buyer message, detailed proposal, amount, and ETA are canonicalized before the final preflight, and the same JSON is POSTed. The gateway rejects a changed payload.
- The existing unique D1 reservation still prevents a second send for the same task. **#3298 remains quarantined**; this patch does not clear, update or retry it.
- This patch does not call Mother/Nova, obtain their keys, grant wallet authority, process payouts, or touch other projects.

## Remaining release blockers
1. PR #19 restores deployed production source but is still draft. Confirm the exact 21-module bundle, Wrangler bindings and D1 schema on a fresh staging Worker.
2. Run the complete repository test suite plus delegated-gate negatives and strict one-send concurrency. The new test asserts 21 adversarial/positive cases.
3. Check `/api/v1/me` returns **Sprite #1878** with approved admission and Bid scope; check authenticated standing, open-order capacity and a heartbeat in the last 14 days.
4. Build/read a task-specific readiness record for a **real, deliverable task**. Category-only or fictional rehearsal is insufficient. Preserve customer materials in the customer's dedicated environment; send only allowed scalar evidence to the bidding agent.
5. Update receipt handling to reconcile the confirmed bid ID/amount/agent and mark unknown transport outcomes without retries. Explicitly resolve #3298 before considering that task again.
6. First use a single, distinct eligible funded task on staging-to-production promotion; confirm an authoritative ClawHunt receipt before expanding the daily autonomous schedule. This is the only basis to state that Sprite has placed a bid.

**Operator authorization does not guarantee acceptance, payment, or a passing review.** Bid content should include task-specific deliverables, verification steps, scope and deadline; fake credentials, generic proposals and unsupported claims remain disallowed.
