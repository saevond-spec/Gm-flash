-- Sprite-only legacy D1 v6 compatibility migration; must run in one transaction.
-- Scope: two Sprite-owned tables only; preserve IDs, amounts, states, timestamps and audit.
-- IMPORTANT: snapshot first, verify foreign_key_check, and do not clear uncertain #3298.
PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;
CREATE TABLE autonomous_readiness_v6_new (
 problem_id TEXT PRIMARY KEY,
 profile TEXT NOT NULL CHECK(profile IN ('csv_cleanup','arithmetic_reconciliation','uat_severity_policy')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 500 AND 100000),
 hours INTEGER NOT NULL CHECK(hours BETWEEN 1 AND 168),
 cost_cents INTEGER NOT NULL CHECK(cost_cents=0),
 platform_limit_cents INTEGER NOT NULL CHECK(platform_limit_cents>=amount_cents),
 scope_verified INTEGER NOT NULL CHECK(scope_verified IN (0,1)),
 isolated_environment_verified INTEGER NOT NULL CHECK(isolated_environment_verified IN (0,1)),
 verified_at INTEGER NOT NULL,
 valid_until INTEGER NOT NULL CHECK(valid_until>verified_at AND valid_until<=verified_at+86400),
 rehearsal_passed INTEGER NOT NULL DEFAULT 0 CHECK(rehearsal_passed IN (0,1))
);
INSERT INTO autonomous_readiness_v6_new SELECT * FROM autonomous_readiness;
CREATE TABLE bid_reservations_v6_new (
 agent_id INTEGER NOT NULL CHECK(agent_id=1878),
 problem_id TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 500 AND 10000000),
 state TEXT NOT NULL CHECK(state IN ('reserved','submitting','submitted','uncertain','rejected')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(agent_id,problem_id)
);
INSERT INTO bid_reservations_v6_new SELECT * FROM bid_reservations;
DROP TABLE autonomous_readiness;
ALTER TABLE autonomous_readiness_v6_new RENAME TO autonomous_readiness;
DROP TABLE bid_reservations;
ALTER TABLE bid_reservations_v6_new RENAME TO bid_reservations;
CREATE TRIGGER sprite_reservation_update_audit AFTER UPDATE OF state ON bid_reservations
 WHEN NEW.agent_id=1878 AND OLD.state<>NEW.state
 BEGIN INSERT INTO sprite_reconciliation_events(agent_id,problem_id,amount_cents,event_type,outcome)
 VALUES(NEW.agent_id,NEW.problem_id,NEW.amount_cents,
 CASE WHEN NEW.state='submitted' THEN 'confirmed_submitted' ELSE 'operator_review' END,
 'reservation_state_'||substr(NEW.state,1,80)); END;
COMMIT;
