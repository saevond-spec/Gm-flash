// Sprite-only NOVA POLICY SIMULATION: pure advisory assessment.
// Never signs, mints an approval, authorizes a marketplace POST or changes Nova.
// Trusted private evidence collection must happen OUTSIDE this module.
// Escrow is optional. Unknown budget/currency/delivery is NOT optional.
import {canonicalBidIntent} from './council-preflight.mjs';

const safe=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const fail=(reason)=>({state:'hold',reason,may_proceed:false,can_submit:false,advisory_only:true});
export function simulateNovaExactBidReview({
  intent, evidence, nowSec, trustedCollectorContext=false
}={}){
  const canonical=canonicalBidIntent(intent);
  if(!canonical||intent.problem_id==='3298')return fail('invalid_or_legacy_intent');
  if(!safe(nowSec,intent.created_at,intent.created_at+899))return fail('expired_or_untrusted_clock');
  // This Boolean alone is not an authentication mechanism: a private Nova Worker
  // must verify its service binding and provenance before invoking this function.
  if(trustedCollectorContext!==true)return fail('trusted_private_collector_not_established');
  if(!evidence||typeof evidence!=='object'||Array.isArray(evidence))
    return fail('independent_market_evidence_missing');
  // Evidence fields must originate from authenticated private RPC and NOT
  // from a user-controlled request. The sandbox cannot prove that provenance.
  if(evidence.agent_id!==1878||evidence.problem_id!==intent.problem_id
    ||evidence.canonical_intent!==canonical||evidence.nonce!==intent.nonce
    ||evidence.amount_cents!==intent.amount_cents)
    return fail('review_evidence_bound_to_different_bid');
  if(evidence.source!=='authenticated_private_collector'
    ||!safe(evidence.collected_at_sec,nowSec-120,nowSec))
    return fail('collector_evidence_missing_or_stale');
  if(evidence.agent_standing!=='eligible'||evidence.owner_active!==true
    ||evidence.own_bid_exists!==false)
    return fail('agent_eligibility_or_existing_bid_unverified');
  if(evidence.task_status!=='open'&&evidence.task_status!=='bidding')
    return fail('task_closed_or_status_unknown');
  if(evidence.task_is_simulated!==false||evidence.currency!=='USD'
    ||!safe(evidence.verified_budget_cents,intent.amount_cents,2000)
    ||!safe(evidence.verified_floor_cents,0,intent.amount_cents)
    ||evidence.verified_budget_cents!==intent.verified_budget_cents
    ||evidence.verified_floor_cents!==intent.verified_floor_cents)
    return fail('market_price_or_currency_unverified');
  if(evidence.acceptance_criteria_complete!==true
    ||evidence.scope_sha256!==intent.scope_sha256
    ||evidence.proposal_sha256!==intent.proposal_sha256
    ||evidence.isolated_delivery_ready!==true
    ||evidence.incremental_cost_cents!==0
    ||evidence.deadline_feasible!==true)
    return fail('delivery_or_approval_scope_unverified');
  if(evidence.reservation_conflict!==false||evidence.nonce_previously_used!==false)
    return fail('existing_reservation_or_replayed_nonce');
  if(evidence.heartbeat_fresh!==true||evidence.platform_quote_allowed!==true)
    return fail('heartbeat_or_platform_limits_unverified');
  // NOT a signed Nova decision. A separately authenticated Nova signer with a
  // private key is required to convert this advisory assessment to an approval.
  return {state:'candidate_for_separate_nova_signer',reason:null,
    eligible_for_signer_review:true,can_submit:false,may_proceed:false,
    advisory_only:true,problem_id:intent.problem_id,escrow_required:false};
}
