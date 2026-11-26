# Sprite #1878 — hide simulated marketplace inventory (live database correction, 2026-11-26)

## Actual production correction performed (not a Worker deployment)

Within Sprite's own Cloudflare D1 ledger, checked **ten exact public task pages** that displayed “Simulated bounty — no real funds are held”:

`2489, 2686, 2690, 2749, 2752, 2757, 3123, 3206, 3292, 3482`

After confirming this on the public marketplace, updated only these exact rows in `sprite_job_inventory_v1` to `simulated=1, bid_ready=0, verification_state='public_page_simulated_nonpaying'`. **Nine** were previously unclassified; **one** (#3482) was already excluded. All ten verified updates succeeded. Existing live code already excludes `i.simulated=1` in important candidate/review pathways, and its inventory upsert intentionally preserves prior `simulated=1` flags on subsequent API refreshes. Nothing was deleted or reclassified as genuine.

Created a persistent, non-destructive D1 **view**:

```sql
CREATE VIEW IF NOT EXISTS sprite_non_simulated_review_inventory_v1 AS
SELECT problem_id, task_status, category, escrow_status,
       budget_cents, simulated, bid_ready, verification_state, last_seen_at,
       CASE WHEN simulated=0 THEN 'reported_not_simulated_requires_current_check'
            ELSE 'simulation_status_unknown_requires_current_check'
       END AS authenticity_state
FROM sprite_job_inventory_v1
WHERE simulated IS NOT 1;
```

Read-back immediately afterward: **1,555** total inventory rows; **67** explicitly simulated and excluded; **1,488** listed for **verification review**, all with **unknown** simulation flags; **zero** simulated flags in the filtered view.

**CRITICAL:** Do not call the 1,488 unknown-status records genuine paying jobs. Their status remains unknown until fresh authenticated marketplace detail contradicts no evidence and verifies that the bounty is not simulated. No-escrow is allowed for a genuine task, but does not promise payment.

## Next integration: hide simulated from current UI

Exact deployed Worker v179 contains a token-protected inventory route that currently reads the unfiltered raw table:

```sql
SELECT problem_id,task_status,category,escrow_status,budget_cents,
       simulated,bid_ready,verification_state
FROM sprite_job_inventory_v1
ORDER BY CAST(problem_id AS INTEGER) DESC
LIMIT ? OFFSET ?;
```

After a **private snapshot of exact live modules** and an authorized source reconciliation, switch that route to **query the new view**, preserving the existing pagination and authentication. Do not deploy the default GitHub `worker.mjs` to make this change: it is outdated relative to production and would overwrite safety controls.

```sql
SELECT problem_id,task_status,category,escrow_status,budget_cents,
       simulated,bid_ready,verification_state,authenticity_state
FROM sprite_non_simulated_review_inventory_v1
ORDER BY CAST(problem_id AS INTEGER) DESC
LIMIT ? OFFSET ?;
```

**Query/pagination MUST filter simulated rows before LIMIT/OFFSET.** Never fetch one page and filter afterward (causes empty pages/starvation).

## Safety

- No marketplace listings were deleted from ClawHunt.
- Preserve bid reservations/receipts (especially uncertain #3200), task histories and customer isolation.
- Do not modify Star, Nova, Mother or customer workspaces.
- No paid services, bids or score assertions triggered by these changes.
- This GitHub document is evidence for eventual integration. It does not itself change the currently deployed dashboard source.

