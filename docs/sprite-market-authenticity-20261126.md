# Sprite #1878 — market authenticity gate (DRAFT / NOT DEPLOYED)

## Live evidence, 2026-11-26 06:30 UTC
Read-only inspection of Sprite-only D1 `sprite_job_inventory_v1`, for records with task status `open` or `bidding`:
- `escrow_status=funded`, `simulated IS NULL`: **1,488**
- `escrow_status=funded`, `simulated=1`: **45**
- `escrow_status=none`, `simulated IS NULL`: **8**
- `escrow_status=none`, `simulated=1`: **12**

The inventory treats funding and simulation separately; **a funded label does not authenticate a paying job**. At the same time, the user's permitted bidding policy includes **no-escrow bids**. Do not treat no escrow as automatically ineligible or as assured payment.

Public ClawHunt pages for sample task IDs #2690 and #2757 explicitly showed a simulation/nonpayment warning while the Sprite inventory listed those tasks as funded with unknown simulation status. Task #3482 was already marked `public_page_simulated_nonpaying` in D1; its public page also showed the warning. This demonstrates disagreement, not a verified global rate of simulated listings. No customer text, files, buyer details or credentials were copied.

Official ClawHunt documentation:
- https://clawhunt.store/for-agents : bid only on work the agent can really finish, with a clear plan and fixed price.
- https://clawhunt.store/for-agents/openclaw : one bid per task; authenticate with own agent API key.
- https://clawhunt.store/agent-docs/webhook : approval, not an optional capability score, is the bidding gate.

## Implemented code
`sprite-market-evidence.mjs` is a **pure, public-metadata-only** authenticity classifier. It returns no input descriptions, files, prompts, credentials or buyer information; performs no network I/O and sends no bid. It:
1. Requires a matching task ID and a fresh, authenticated Sprite-context task-detail observation.
2. Rejects explicit simulation flags (both booleans and D1 integer 0/1), including simulated public-page warnings; contradictory evidence is quarantined rather than guessed away.
3. For reported funded tasks, verifies consistent published price/escrow amount and cent/credit units. Returns **reported-funded, escrow unguaranteed**, never 'money verified'.
4. For explicit no-escrow tasks, verifies published reference budget, labels payment risk, and keeps the candidate *reviewable* if otherwise genuine.
5. Uses the existing live executor's current quote bounds (`$20–$1,000`), not the aspirational policy's `$100,000`; the mismatch requires a separate authorized repair.
6. Never marks any task automatically bid-authorized. Detailed acceptance review and dedicated isolated customer workspace stay **post-award**.

## Robust decision rule
Treat authenticity as a **hard feasibility constraint**, not an invented estimated win probability:

`feasible_for_bid_review = authenticated_id && fresh && not_simulated && price_consistent && status_open && no_known_conflict`.

Only when true should other features (delivery capability, proposal, time, price and risk-adjusted expected utility) be evaluated. Under unknown simulation evidence, the worst-case chance of nonpayment is unbounded from the current records; minimax/interval reasoning therefore returns *needs evidence*, not 'eligible'. This is a conservative candidate-review decision, not an official marketplace score.

## Release requirements
- Do **not** deploy stale GitHub `main` over the v179 live Worker.
- Reconstruct exact production modules privately and reconcile safely.
- Wire the authenticated task-detail / public warning checks inside Sprite's authorized review, not a global bypass.
- Preserve unique reservation, uncertain bid #3200, true agent #1878 identity and independently matched post-bid receipt.
- No customer data may leave a per-customer sandbox, and no Mother/Nova/Star files or secrets may enter this review.
- Run integration and genuine live market verification **before** treating the prototype as a production fix.

These are draft engineering tests, not 20 live bids, a verified ClawHunt acceptance benchmark or proof of payment.
