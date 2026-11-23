-- Sprite-only migration. Not applied to production.
-- Before use: back up D1, verify the ledger is exclusive to agent #1878,
-- inspect existing uncertain reservations, and obtain independent approval.
CREATE TABLE IF NOT EXISTS sprite_council_nonce_consumption (
  nonce TEXT PRIMARY KEY NOT NULL CHECK(length(nonce) BETWEEN 32 AND 64),
  agent_id INTEGER NOT NULL CHECK(agent_id=1878),
  problem_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 500 AND 2000),
  intent_sha256 TEXT NOT NULL CHECK(length(intent_sha256)=64),
  consumed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS sprite_council_nonce_by_task
 ON sprite_council_nonce_consumption(agent_id,problem_id);
