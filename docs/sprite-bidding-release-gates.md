# Sprite 1878 — integrated bidding release gates

**Status:** integration branch only; **NOT DEPLOYED**, **no live bid attempted** by this branch. All third-party customer files, credentials and project runtimes must remain isolated from Sprite, Mother, Nova and other customer projects.

## Code integrated on `fix/sprite-production-bidding-20261124`

- Restored the exact deployed main `worker.mjs` and the 20 production modules, except the intentionally improved `sprite-autonomous-signed-v1.mjs` from the prior draft.
- Restored production service bindings for `MOTHER_MATH`, `NOVA_REVIEW`, `BID_SANDBOX` in Wrangler. **Never store secrets in Wrangler source.**
- Replaced undocumented `page=` browse with the documented `limit` and `offset` parameters; retained deduplication and conservative detail checks.
- Added `clawhunt-bid-contract.mjs`: funded/ref-price bounds with no claim of actual payout for no-escrow tasks, cents validation, the full documented bid payload, and a 25% platform-fee estimate.
- Added strict authenticated receipt normalization for nested `id`/`agent.id`/`estimated_cost` structures. Missing task identity may only be inferred from a directly authenticated POST response to the exact task URL, never from a generic list/detail read.
- Kept the shared irreversible reservation guard. Existing #3298 reservation is untouched.
- Coalesced concurrent `GET /api/v1/me` requests **without caching stale approval state**.
- Aligned the executable minimum bid to USD $20; the currently deployed legacy signer remains capped at USD $1,000, pending schema migration.
- Updated the proposed D1 v2 reservation schema to Mother+Nova, retaining nonce consumption, pre-network SUBMITTING, UNKNOWN on ambiguity and append-only audit. **This schema remains a draft and has not been installed in production.**
- Added GitHub Actions Node regression workflow and contract fixtures. Latest successful run: 107/107 Node tests passing.

## Never infer
- `price`, `reference_price` and `escrow_amount` are not interchangeable without verified funding status. A reference price does not guarantee payout.
- Platform HTTP 200 is not a receipt.
- Independent signatures are not independent scope review unless their underlying evidence is independently verified.
- Simulated or synthetic test approvals are not authority for a live bid.
- The existence of a bid ID does not resolve bid amount or outcome; #3298 remains UNKNOWN.
- Customer execution is not certified by a fictional arithmetic/CSV rehearsal.

## Mandatory pre-deploy gates

1. Obtain authoritative authenticated `/api/v1/bids/queue`, `/api/v1/bids/standing`, `/api/v1/me` and a bounded read of real `/api/v1/problems/{id}` for each candidate. Confirm account ownership, admitted agent, current task, documented floor/ceiling, exact units and no existing bid.
2. Preserve a single immutable, hash-bound `BidIntent`: agent ID, task ID, amount, buyer message, complete proposal, structured scope, delivery estimate, exact acceptance criteria, verified funding terms, nonce and expiration. Do not sign only the proposal when the POST includes additional contractual fields.
3. Prove an isolated customer execution environment and task-specific deliverability with independent evidence. Currently the production isolation lab explicitly disables customer admission.
4. Implement **real** Mother and Nova signer issuance using one canonical protocol and distinct protected signing keys. The deployed v1 issuers currently refuse signing: `independent_scope_and_delivery_proof_required`. Reviewer replicas must not be presented as independent review.
5. Integrate the verified signatures with the proposed atomic D1 reservation and check that keys are current, nonces single-use, approvals unexpired/unrevoked and all immutable fields agree. Install migration **only in isolated staging** first; test rollback, crash, replay, wrong-role and concurrent sends.
6. Persist `SUBMITTING` *before* the ClawHunt POST. On timeout or ambiguous response mark UNKNOWN and reconcile without retries. Confirm only with official task/agent/amount/bid ID evidence; preserve current outcome separately from bid existence.
7. Capture the platform `instant_review` after a real POST. Allow at most three properly authorized pending-bid revisions; **never** create a second bid on the same task.
8. Run a production-equivalent full test suite; verify the deployed source matches the branch and that existing non-bidding functions are not regressed. Confirm all service bindings and secrets by name only. Stage and deploy only after review.

## Release condition

One successful **authenticated, independently approved, receipt-confirmed** bid on a genuinely deliverable ClawHunt job must be observed before permitting multiple autonomous submissions on different jobs. The current branch implements vital prerequisites but **does not yet satisfy these release gates**. No production deployment or bid should be inferred from green Node tests.
