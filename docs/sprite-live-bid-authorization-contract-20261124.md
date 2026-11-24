# Sprite live-bid authorization interface contract (2026-11-24)

**Scope:** Sprite (agent 1878) only. No Star or customer materials, credentials, storage, or services. This is a production repair checklist; not an issuance credential or authorization to place a bid.

## Confirmed by deployed Cloudflare Worker inspection

- Mother Worker `mother-coordination` and Nova Worker `nova-verifier` each expose `signSpriteAutonomousBid(packet)` through a private WorkerEntrypoint. Both enforce public task checks and then **unconditionally return** `independent_scope_and_delivery_proof_required`, without signing anything.
- Their expected input is `sprite.autonomous.bid.v1` with `{agent_id, problem_id, amount_cents, profile, hours, cost_cents, issued_at, expires_at, nonce, evidence_digest}`. Neither asks for a `proposal_digest` or signs the production verifier's v2 message.
- Production `gm-flash` uses `checkSignedBid()` over stored rows with fields `{role, agent_id, amount_cents, issued_at, expires_at, nonce, evidence_digest, proposal_digest, signature_b64, consumed_at}`. Signature payload is `sprite.autonomous.bid.v2|1878|problem|amount|issued|expires|nonce|evidence_digest|proposal_digest`. Both reviewer keys are registered, but there are zero approval rows.
- Production readiness is empty. The latest scan examined 33 tasks and discovered no verified-budget candidates; many public job payloads have no unambiguous `budget_cents`. Never interpret `price:0`, `floor_cents`, or an estimated display price as a funded offer.
- Last autonomous dispatch returned `identity_unavailable`; prior authenticated probes returned HTTP 200 for agent 1878, so verify freshness and error cause rather than claiming permanent disconnection.
- Prior task 3298 has an unresolved `uncertain` bid reservation; do not resend.
- `gm-flash` GitHub `main` is older than the currently deployed Worker bundle; rebase against exact deployed modules, not stale source.

## Required production implementation (not yet completed)

1. Keep each signer's Ed25519 **private key in its own Worker**. Require the exact issuer's public key to match independently registered production key ID; never reuse fictional stage keys. No public or unsigned issue/sign routes.
2. Freeze the final proposal text and derive SHA-256; bind it to job ID, exact quote cents, agent 1878, nonce, deadline, verified scope digest, capability, and environment. Use ONE versioned signed-message format on BOTH issuance and verification. Prefer the v2 verifier's `sprite.autonomous.bid.v2` format; version changes require explicit migration and key continuity proof. Do not synthesize or insert approval rows into production.
3. Obtain separate, independent Mother and Nova review evidence: current authenticated task identity/admission, authoritative budget and currency, real-vs-simulated classification, acceptance criteria, deliverability within deadline, zero incremental cost, isolated customer workspace, and no existing bid. Each signer must reject missing evidence and perform its own substantive checks.
4. The operator approval must be separately authenticated and explicitly recorded for the exact immutable bid intent. Never treat a chat statement as a cryptographically valid signature or copy Mother/Nova signatures into the operator role.
5. Persist VERIFIED signature certificates and an atomic D1 reservation with a single-use nonce. The SQL staging schema does NOT cryptographically validate signatures; privileged DB writes must be restricted to a trusted service that calls `checkSignedBid`. Enforce the one-active-task constraint, replay/expiry/revocation checks, state transitions, and append-only audit.
6. Resolve the ordering issue: a one-time approval must be consumed and a reservation created BEFORE the marketplace POST; do not consume approval irreversibly in a callback after reservation without a crash-safe handoff. Set SUBMITTING before touching the network. If POST outcome is unknown, leave UNKNOWN and reconcile, never retry blindly.
7. Use platform-documented amount units, verified listing status, and an exact maximum not exceeding the buyer's budget. User authorizes $20 floor and no escrow requirement, but simulated/unfunded jobs are not automatically payable.
8. Mark CONFIRMED only with an authenticated bid ID, exact job, exact agent and amount, plus an independent receipt. If the API returns an ambiguous response, quarantine UNKNOWN. No fabricated receipts.
9. Add replay, wrong-agent, wrong-role, timestamp, revoked-key, missing-budget, simulated-job, duplicate-submit, concurrent-request, unknown-response, and crash-recovery integration tests.
10. Do not merge or deploy this draft without testing against the exact production release and proving non-regression for all existing capabilities.

## Verified non-production evidence

- Earlier 12/12 Node Ed25519 verifier tests and 8/8 SQLite tests passed.
- Live Cloudflare D1 staged fictional reservation for task 999999991 with 3 approval records, nonce consumed, replay rejected, no-receipt confirmation rejected, crash recovery to UNKNOWN.
- Separate D1 batch rollback test: failed duplicate primary-key insert rolled back previous update.
- Stage-only testing proves database behavior, NOT signer authenticity, payout, or marketplace success.
