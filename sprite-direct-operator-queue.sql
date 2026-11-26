-- Sprite #1878 only: D1 operator-authorized public bid command queue.
-- Private D1 management write ONLY. Never expose inserts through web routes.
-- No customer content, proposal, credentials or sensitive audit material.
-- DRAFT: not yet migrated into production.
CREATE TABLE IF NOT EXISTS sprite_operator_bid_requests_v1 (
 problem_id TEXT PRIMARY KEY CHECK (
   length(problem_id) BETWEEN 1 AND 10
   AND problem_id GLOB '[1-9]*'
   AND problem_id NOT GLOB '*[^0-9]*'
 ),
 agent_id INTEGER NOT NULL CHECK(agent_id=1878),
 amount_ceiling_cents INTEGER NOT NULL CHECK(amount_ceiling_cents BETWEEN 2000 AND 100000),
 issued_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at > issued_at AND expires_at <= issued_at + 86400),
 source TEXT NOT NULL CHECK(source='explicit_operator_cloudflare_command'),
 state TEXT NOT NULL DEFAULT 'queued'
   CHECK(state IN ('queued','processing','confirmed','held','uncertain','rejected')),
 result_code TEXT CHECK(length(result_code)<=70)
);
-- One row per job; no automatic rollback or duplicate sends.
-- For insertion, choose a specific verified job, require source string above,
-- and use bound parameters with a trusted management-side operator action.
