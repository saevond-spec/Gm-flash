# Sprite #1878 — live D1 simulation quarantine, Nov 26, 2026

**Status:** Applied to Sprite-only Cloudflare D1; Worker v179 code remains unchanged. Read-only verification followed. No marketplace bids sent, customer data moved, or other agents invoked.

## Why

ClawHunt's official guide says simulated bounty listings hold **no real funds**. It also permits team-account listings without funds and instructs agents to verify funding before starting. Source: https://clawhunt.store/for-agents/openclaw

The genuine real-world inventory discrepancy was:
- 1,555 retained inventory records; 67 marked `simulated=1`, 1,488 still unknown (`NULL`). All have `bid_ready=0`.
- The immutable public funding evidence table recorded 20 `observed_simulated=1` and **zero confirmed `observed_simulated=0`**.
- At 06:40 UTC, the latest `scan_status.candidate_ids` held ten IDs including known simulated #3277, while the dashboard's raw inventory endpoint continued to read the unfiltered table.

**Unknown does not mean real**. These counts must not be presented as 1,488 paying jobs. Genuine offers require fresh, matching authenticated ClawHunt task details. Listings marked `not funded yet` are not payout-guaranteed. Some no-escrow bids can be submitted under user policy, but never labelled held-payment.

## Production changes

Created three narrowly-scoped D1 triggers, preserving all historical rows and receipts.

### 1. Filter active scan on database write

```sql
CREATE TRIGGER IF NOT EXISTS sprite_screen_simulated_candidates_v1
AFTER UPDATE OF candidate_ids ON scan_status
WHEN EXISTS (
  SELECT 1 FROM json_each(CASE WHEN json_valid(NEW.candidate_ids)
    THEN NEW.candidate_ids ELSE '[]' END) j
  WHERE EXISTS(SELECT 1 FROM sprite_job_inventory_v1 i
    WHERE i.problem_id=CAST(j.value AS TEXT) AND i.simulated=1)
     OR EXISTS(SELECT 1 FROM sprite_public_funding_evidence_v1 p
    WHERE p.problem_id=CAST(j.value AS TEXT) AND p.observed_simulated=1)
)
BEGIN
  UPDATE scan_status SET candidate_ids=(
    SELECT COALESCE(json_group_array(CAST(j.value AS TEXT)),'[]')
    FROM json_each(CASE WHEN json_valid(NEW.candidate_ids)
      THEN NEW.candidate_ids ELSE '[]' END) j
    WHERE NOT EXISTS(SELECT 1 FROM sprite_job_inventory_v1 i
      WHERE i.problem_id=CAST(j.value AS TEXT) AND i.simulated=1)
      AND NOT EXISTS(SELECT 1 FROM sprite_public_funding_evidence_v1 p
      WHERE p.problem_id=CAST(j.value AS TEXT) AND p.observed_simulated=1)
  ) WHERE id=NEW.id;
END;
```

### 2. Remove a newly-flagged simulated job from the stored active scan

```sql
CREATE TRIGGER IF NOT EXISTS sprite_inventory_simulation_quarantine_v1
AFTER UPDATE OF simulated ON sprite_job_inventory_v1
WHEN NEW.simulated=1
BEGIN
  UPDATE sprite_job_inventory_v1 SET bid_ready=0
    WHERE problem_id=NEW.problem_id AND bid_ready<>0;
  UPDATE scan_status SET candidate_ids=candidate_ids WHERE id=1
    AND EXISTS(
      SELECT 1 FROM json_each(CASE WHEN json_valid(candidate_ids)
        THEN candidate_ids ELSE '[]' END) j
      WHERE CAST(j.value AS TEXT)=NEW.problem_id
    );
END;
```

### 3. Quarantine future official public simulated evidence

```sql
CREATE TRIGGER IF NOT EXISTS sprite_public_simulation_evidence_quarantine_v1
AFTER INSERT ON sprite_public_funding_evidence_v1
WHEN NEW.observed_simulated=1
BEGIN
  UPDATE sprite_job_inventory_v1
  SET simulated=1,bid_ready=0,
    verification_state='public_page_simulated_nonpaying'
  WHERE problem_id=NEW.problem_id AND simulated IS NOT 1;
END;
```

**Observed actual effect:** after trigger 1, the singleton active scan changed from ten candidate IDs (including #3277) to nine IDs excluding #3277. Query verified **zero marked simulated in the active list**. Trigger 2 and 3 were created and confirmed in `sqlite_master`. No synthetic records were inserted to test them.

The previous `sprite_non_simulated_review_inventory_v1` and `sprite_non_simulated_latest_scan_v1` views remain available for read-only comparisons.

## Limitations / further work

- Production Worker's *in-memory* current scan record and the `/api/problems?source=inventory` route are **not** rewritten by D1 triggers; the Worker still needs a synchronized, approved source fix to filter in the producer and dashboard.
- The displayed `scan_status.funded_candidates` retains the scanner's pre-quarantine count. Do not interpret it as a verified-paying-task count. Use filtered IDs and authenticated price evidence.
- The public evidence table only proves *known simulated* tasks; unknown-status listings require real authentication and verification. A scan/heartbeat/old receipt is not a paid job.
- The correct 20-bid campaign requires independent Sprite #1878 authentication, real biddable tasks, truthful matching proposals, buyer acceptances, and genuine individual receipts. Those were not accomplished by the quarantine.

## Rollback (only after verifying if there is a regression)

```sql
DROP TRIGGER IF EXISTS sprite_public_simulation_evidence_quarantine_v1;
DROP TRIGGER IF EXISTS sprite_inventory_simulation_quarantine_v1;
DROP TRIGGER IF EXISTS sprite_screen_simulated_candidates_v1;
```

Do not delete simulated evidence or rewrite bid/provenance histories. No source deploy/merge without reconciling Worker v179 against the stale GitHub main branch.
