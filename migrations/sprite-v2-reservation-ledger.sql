-- Sprite-only D1 v2 authorization ledger; not automatically migrated or enabled.
-- Before persisting a certificate, a trusted server-side verifier MUST verify its
-- Ed25519 signature and exact role/action/agent/job/amount/evidence/nonce bindings.
-- SQLite cannot verify Ed25519 itself; untrusted clients must never receive D1 writes.
-- Reservation uses ONE INSERT; its triggers consume nonce and attach two independent approvals atomically.
PRAGMA foreign_keys=ON;
CREATE TABLE sprite_v2_nonces (
  nonce TEXT PRIMARY KEY CHECK(length(nonce)=32 AND nonce NOT GLOB '*[^0-9a-f]*'),
  problem_id TEXT NOT NULL, agent_id INTEGER NOT NULL CHECK(agent_id=1878),
  expires_at INTEGER NOT NULL, consumed_at INTEGER
);
CREATE TABLE sprite_v2_approval_certificates (
  approval_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('mother','nova')),
  nonce TEXT NOT NULL REFERENCES sprite_v2_nonces(nonce),
  agent_id INTEGER NOT NULL CHECK(agent_id=1878),problem_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 2000 AND 10000000),
  evidence_hash TEXT NOT NULL CHECK(length(evidence_hash)=64 AND evidence_hash NOT GLOB '*[^0-9a-f]*'),
  proposal_hash TEXT NOT NULL CHECK(length(proposal_hash)=64 AND proposal_hash NOT GLOB '*[^0-9a-f]*'),
  key_id TEXT NOT NULL,signature_b64 TEXT NOT NULL,expires_at INTEGER NOT NULL,
  UNIQUE(nonce,role)
);
CREATE TABLE sprite_v2_revocations(
  approval_id TEXT PRIMARY KEY REFERENCES sprite_v2_approval_certificates(approval_id),
  revoked_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE TABLE sprite_v2_reservations (
  reservation_id TEXT PRIMARY KEY,problem_id TEXT NOT NULL,
  agent_id INTEGER NOT NULL CHECK(agent_id=1878),
  amount_cents INTEGER NOT NULL CHECK(amount_cents BETWEEN 2000 AND 10000000),
  evidence_hash TEXT NOT NULL CHECK(length(evidence_hash)=64 AND evidence_hash NOT GLOB '*[^0-9a-f]*'),
  proposal_hash TEXT NOT NULL CHECK(length(proposal_hash)=64 AND proposal_hash NOT GLOB '*[^0-9a-f]*'),
  nonce TEXT NOT NULL UNIQUE REFERENCES sprite_v2_nonces(nonce),
  approvals_expire_at INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'RESERVED' CHECK(state IN
    ('RESERVED','SUBMITTING','CONFIRMED','UNKNOWN','RELEASED_UNSENT','NOT_PLACED')),
  bid_id TEXT,resolution_evidence_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK(bid_id IS NULL OR (bid_id GLOB '[1-9]*' AND bid_id NOT GLOB '*[^0-9]*')),
  CHECK(resolution_evidence_hash IS NULL OR
    (length(resolution_evidence_hash)=64 AND resolution_evidence_hash NOT GLOB '*[^0-9a-f]*'))
);
CREATE UNIQUE INDEX sprite_v2_one_active_per_problem
 ON sprite_v2_reservations(agent_id,problem_id)
 WHERE state IN ('RESERVED','SUBMITTING','UNKNOWN','CONFIRMED');
CREATE TABLE sprite_v2_reservation_approvals(
 reservation_id TEXT NOT NULL REFERENCES sprite_v2_reservations(reservation_id),
 approval_id TEXT NOT NULL UNIQUE REFERENCES sprite_v2_approval_certificates(approval_id),
 PRIMARY KEY(reservation_id,approval_id)
);
CREATE TABLE sprite_v2_audit(
 id INTEGER PRIMARY KEY AUTOINCREMENT,ts INTEGER NOT NULL DEFAULT (unixepoch()),
 event TEXT NOT NULL,problem_id TEXT,reservation_id TEXT,detail TEXT
);
CREATE TRIGGER sprite_v2_reserve_check BEFORE INSERT ON sprite_v2_reservations
BEGIN
 SELECT CASE WHEN NEW.state!='RESERVED' OR NEW.bid_id IS NOT NULL OR
   NEW.resolution_evidence_hash IS NOT NULL OR NEW.created_at!=unixepoch() OR
   NEW.updated_at!=unixepoch() THEN RAISE(ABORT,'invalid_initial_state_or_clock') END;
 SELECT CASE WHEN NOT EXISTS (
   SELECT 1 FROM sprite_v2_nonces n
   WHERE n.nonce=NEW.nonce AND n.agent_id=NEW.agent_id
     AND n.problem_id=NEW.problem_id AND n.consumed_at IS NULL
     AND n.expires_at>unixepoch())
   THEN RAISE(ABORT,'nonce_unknown_replayed_or_expired') END;
 SELECT CASE WHEN
 (SELECT COUNT(*) FROM sprite_v2_approval_certificates a
  WHERE a.nonce=NEW.nonce AND a.agent_id=NEW.agent_id AND a.problem_id=NEW.problem_id
    AND a.amount_cents=NEW.amount_cents AND a.evidence_hash=NEW.evidence_hash
    AND a.proposal_hash=NEW.proposal_hash AND a.expires_at>unixepoch()
    AND NOT EXISTS(SELECT 1 FROM sprite_v2_revocations v
                   WHERE v.approval_id=a.approval_id))!=2
 OR (SELECT COUNT(DISTINCT a.role) FROM sprite_v2_approval_certificates a
  WHERE a.nonce=NEW.nonce AND a.agent_id=NEW.agent_id AND a.problem_id=NEW.problem_id
    AND a.amount_cents=NEW.amount_cents AND a.evidence_hash=NEW.evidence_hash
    AND a.proposal_hash=NEW.proposal_hash AND a.expires_at>unixepoch()
    AND NOT EXISTS(SELECT 1 FROM sprite_v2_revocations v
                   WHERE v.approval_id=a.approval_id))!=2
 OR NEW.approvals_expire_at!=(SELECT MIN(expires_at)
                                FROM sprite_v2_approval_certificates WHERE nonce=NEW.nonce)
 THEN RAISE(ABORT,'two_bound_approvals_required') END;
END;
CREATE TRIGGER sprite_v2_reserve_write AFTER INSERT ON sprite_v2_reservations
BEGIN
 UPDATE sprite_v2_nonces SET consumed_at=unixepoch()
   WHERE nonce=NEW.nonce AND consumed_at IS NULL;
 INSERT INTO sprite_v2_reservation_approvals(reservation_id,approval_id)
   SELECT NEW.reservation_id,approval_id
   FROM sprite_v2_approval_certificates WHERE nonce=NEW.nonce;
 INSERT INTO sprite_v2_audit(event,problem_id,reservation_id,detail)
   VALUES('reserved',NEW.problem_id,NEW.reservation_id,'RESERVED');
END;
CREATE TRIGGER sprite_v2_transition BEFORE UPDATE OF state ON sprite_v2_reservations
WHEN NOT(
 (OLD.state='RESERVED' AND NEW.state IN ('SUBMITTING','RELEASED_UNSENT'))
 OR (OLD.state='SUBMITTING' AND NEW.state IN ('UNKNOWN','CONFIRMED')
      AND (NEW.state!='CONFIRMED' OR
          (NEW.resolution_evidence_hash IS NOT NULL AND NEW.bid_id IS NOT NULL)))
 OR (OLD.state='UNKNOWN' AND NEW.state IN ('CONFIRMED','NOT_PLACED')
      AND NEW.resolution_evidence_hash IS NOT NULL AND
       (NEW.state!='CONFIRMED' OR NEW.bid_id IS NOT NULL))
)
BEGIN SELECT RAISE(ABORT,'invalid_transition'); END;
CREATE TRIGGER sprite_v2_submit_guard BEFORE UPDATE OF state ON sprite_v2_reservations
WHEN OLD.state='RESERVED' AND NEW.state='SUBMITTING'
BEGIN
 SELECT CASE WHEN OLD.approvals_expire_at<=unixepoch()
 OR (SELECT COUNT(*) FROM sprite_v2_reservation_approvals ra
     JOIN sprite_v2_approval_certificates a ON a.approval_id=ra.approval_id
    WHERE ra.reservation_id=OLD.reservation_id AND a.expires_at>unixepoch()
      AND a.problem_id=OLD.problem_id AND a.agent_id=OLD.agent_id
      AND a.amount_cents=OLD.amount_cents AND a.evidence_hash=OLD.evidence_hash
      AND a.proposal_hash=OLD.proposal_hash AND a.nonce=OLD.nonce
      AND NOT EXISTS(SELECT 1 FROM sprite_v2_revocations v
                     WHERE v.approval_id=a.approval_id))!=2
 THEN RAISE(ABORT,'submit_approvals_expired_or_revoked') END;
END;
CREATE TRIGGER sprite_v2_immutable BEFORE UPDATE OF
 reservation_id,problem_id,agent_id,amount_cents,evidence_hash,proposal_hash,
 nonce,approvals_expire_at,created_at ON sprite_v2_reservations
BEGIN SELECT RAISE(ABORT,'immutable_core'); END;
CREATE TRIGGER sprite_v2_clock BEFORE UPDATE OF updated_at ON sprite_v2_reservations
WHEN NEW.updated_at!=unixepoch()
BEGIN SELECT RAISE(ABORT,'database_clock_required'); END;
CREATE TRIGGER sprite_v2_set_once BEFORE UPDATE OF
 bid_id,resolution_evidence_hash ON sprite_v2_reservations
WHEN (OLD.bid_id IS NOT NULL AND NEW.bid_id IS NOT OLD.bid_id)
 OR (OLD.resolution_evidence_hash IS NOT NULL AND
     NEW.resolution_evidence_hash IS NOT OLD.resolution_evidence_hash)
 OR (NEW.bid_id IS NOT NULL AND NEW.state!='CONFIRMED')
 OR (NEW.resolution_evidence_hash IS NOT NULL AND
     NEW.state NOT IN ('CONFIRMED','NOT_PLACED'))
BEGIN SELECT RAISE(ABORT,'resolution_immutable_or_invalid'); END;
CREATE TRIGGER sprite_v2_audit_state AFTER UPDATE OF state ON sprite_v2_reservations
BEGIN
 INSERT INTO sprite_v2_audit(event,problem_id,reservation_id,detail)
  VALUES('state_change',NEW.problem_id,NEW.reservation_id,
         OLD.state||'->'||NEW.state);
END;
CREATE TRIGGER sprite_v2_reservations_no_delete BEFORE DELETE ON sprite_v2_reservations
BEGIN SELECT RAISE(ABORT,'no_delete'); END;
CREATE TRIGGER sprite_v2_nonce_no_delete BEFORE DELETE ON sprite_v2_nonces
BEGIN SELECT RAISE(ABORT,'no_delete'); END;
CREATE TRIGGER sprite_v2_nonce_immutable BEFORE UPDATE OF
 nonce,problem_id,agent_id,expires_at ON sprite_v2_nonces
BEGIN SELECT RAISE(ABORT,'nonce_immutable'); END;
CREATE TRIGGER sprite_v2_nonce_once BEFORE UPDATE OF consumed_at ON sprite_v2_nonces
WHEN OLD.consumed_at IS NOT NULL OR NEW.consumed_at!=unixepoch()
BEGIN SELECT RAISE(ABORT,'nonce_once'); END;
CREATE TRIGGER sprite_v2_certificate_immutable BEFORE UPDATE ON sprite_v2_approval_certificates
BEGIN SELECT RAISE(ABORT,'certificate_immutable'); END;
CREATE TRIGGER sprite_v2_certificate_no_delete BEFORE DELETE ON sprite_v2_approval_certificates
BEGIN SELECT RAISE(ABORT,'certificate_immutable'); END;
CREATE TRIGGER sprite_v2_cert_expiry BEFORE INSERT ON sprite_v2_approval_certificates
WHEN NEW.expires_at<=unixepoch() OR NOT EXISTS(
 SELECT 1 FROM sprite_v2_nonces n WHERE n.nonce=NEW.nonce
   AND n.problem_id=NEW.problem_id AND n.agent_id=NEW.agent_id
   AND n.consumed_at IS NULL AND n.expires_at>unixepoch())
BEGIN SELECT RAISE(ABORT,'certificate_nonce_expired_or_consumed'); END;
CREATE TRIGGER sprite_v2_revocations_immutable BEFORE UPDATE ON sprite_v2_revocations
BEGIN SELECT RAISE(ABORT,'append_only'); END;
CREATE TRIGGER sprite_v2_revocations_no_delete BEFORE DELETE ON sprite_v2_revocations
BEGIN SELECT RAISE(ABORT,'append_only'); END;
CREATE TRIGGER sprite_v2_ra_immutable BEFORE UPDATE ON sprite_v2_reservation_approvals
BEGIN SELECT RAISE(ABORT,'append_only'); END;
CREATE TRIGGER sprite_v2_ra_no_delete BEFORE DELETE ON sprite_v2_reservation_approvals
BEGIN SELECT RAISE(ABORT,'append_only'); END;
CREATE TRIGGER sprite_v2_ra_scope BEFORE INSERT ON sprite_v2_reservation_approvals
WHEN NOT EXISTS (
 SELECT 1 FROM sprite_v2_reservations r
 JOIN sprite_v2_approval_certificates a ON a.approval_id=NEW.approval_id
 WHERE r.reservation_id=NEW.reservation_id AND r.state='RESERVED'
   AND a.nonce=r.nonce AND a.agent_id=r.agent_id AND a.problem_id=r.problem_id
   AND a.amount_cents=r.amount_cents AND a.evidence_hash=r.evidence_hash
   AND a.proposal_hash=r.proposal_hash
)
BEGIN SELECT RAISE(ABORT,'mapping_scope_invalid'); END;
CREATE TRIGGER sprite_v2_audit_immutable BEFORE UPDATE ON sprite_v2_audit
BEGIN SELECT RAISE(ABORT,'append_only'); END;
CREATE TRIGGER sprite_v2_audit_no_delete BEFORE DELETE ON sprite_v2_audit
BEGIN SELECT RAISE(ABORT,'append_only'); END;
