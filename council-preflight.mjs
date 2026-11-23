// Sprite-only, side-effect-free preflight. Does NOT authorize a bid to be sent.
// Production integration MUST independently authenticate both review signers,
// enforce the global governance hold, and consume approval nonce + reservation
// atomically in the Sprite-only D1 ledger before any marketplace POST.
const HASH = /^[0-9a-f]{64}$/;
const NONCE = /^[0-9a-f]{32,64}$/;
const ID = /^[1-9]\d{0,9}$/;
const int = (x, lo, hi) => Number.isSafeInteger(x) && x >= lo && x <= hi;

export function canonicalBidIntent(x) {
  if (!x || x.agent_id !== 1878 || !ID.test(x.problem_id)
      || !int(x.amount_cents, 500, 2000) || !int(x.verified_budget_cents, x.amount_cents, 2000)
      || !int(x.verified_floor_cents, 0, x.amount_cents)
      || x.currency !== 'USD' || x.incremental_cost_cents !== 0
      || !HASH.test(x.proposal_sha256) || !HASH.test(x.scope_sha256)
      || !NONCE.test(x.nonce) || !int(x.created_at, 1, Number.MAX_SAFE_INTEGER)) return null;
  return 'sprite-bid-v1|' + [x.agent_id,x.problem_id,x.amount_cents,x.verified_budget_cents,x.verified_floor_cents,x.currency,x.incremental_cost_cents,x.proposal_sha256,x.scope_sha256,x.nonce,x.created_at].join('|');
}

function approvalMatches(a, reviewer, canonical, nowSec, intent) {
  return a && a.reviewer === reviewer && a.decision === 'approve' && a.canonical_intent === canonical
    && a.problem_id === intent.problem_id && a.amount_cents === intent.amount_cents
    && a.nonce === intent.nonce && int(a.approved_at, intent.created_at, nowSec)
    && int(a.expires_at, nowSec + 1, intent.created_at + 900);
}

export async function councilBidPreflight({intent, mother, nova, control, verifyMother, verifyNova, verifyControl, readLedger, nowSec}) {
  const deny = reason => ({state:'hold', reason, can_submit:false, may_release_governance_hold:false});
  const canonical = canonicalBidIntent(intent);
  if (!canonical || !int(nowSec, intent?.created_at ?? 0, (intent?.created_at ?? 0) + 900)) return deny('invalid_or_expired_intent');
  // The original #3298 submission is uncertain. No resubmission path is authorized.
  if(intent.problem_id==='3298')return deny('legacy_bid_3298_held');
  if (!approvalMatches(mother, 'mother', canonical, nowSec, intent)) return deny('mother_approval_missing_or_mismatched');
  if (!approvalMatches(nova, 'nova', canonical, nowSec, intent)) return deny('nova_approval_missing_or_mismatched');
  if (!approvalMatches(control, 'chatgpt_operator', canonical, nowSec, intent)) return deny('control_approval_missing_or_mismatched');
  // Assertions within JSON are untrusted. Only separately provisioned, strongly authenticated
  // verifier implementations may return true. Never provide user-supplied verifier code in production.
  if (typeof verifyMother !== 'function' || typeof verifyNova !== 'function' || typeof verifyControl !== 'function' || typeof readLedger !== 'function') return deny('trusted_services_missing');
  try {
    if (await verifyMother(mother, canonical) !== true) return deny('mother_signature_unverified');
    if (await verifyNova(nova, canonical) !== true) return deny('nova_signature_unverified');
    if (await verifyControl(control, canonical) !== true) return deny('control_signature_unverified');
    const ledger = await readLedger(intent.problem_id,intent.nonce);
    if (!ledger || ledger.available !== true || ledger.blocking_unresolved_bid !== false || ledger.existing_reservation !== false || ledger.nonce_seen !== false) return deny('ledger_blocked_or_unavailable');
  } catch { return deny('trusted_service_error'); }
  return {state:'preflight_passed_not_released', reason:'requires_atomic_one_time_nonce_and_reservation',
    can_submit:false, may_release_governance_hold:false, problem_id:intent.problem_id};
}
