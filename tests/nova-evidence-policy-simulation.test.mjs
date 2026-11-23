import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {simulateNovaExactBidReview} from '../nova-evidence-policy-simulation.mjs';
const NOW=1800000000;
const bid=()=>({agent_id:1878,problem_id:'9811',amount_cents:750,
 verified_budget_cents:900,verified_floor_cents:500,currency:'USD',
 incremental_cost_cents:0,proposal_sha256:'a'.repeat(64),scope_sha256:'b'.repeat(64),
 nonce:'c'.repeat(32),created_at:NOW});
const fixture=()=>{
 const intent=bid();
 const evidence={
  source:'authenticated_private_collector',collected_at_sec:NOW+1,
  agent_id:1878,problem_id:intent.problem_id,canonical_intent:canonicalBidIntent(intent),
  nonce:intent.nonce,amount_cents:intent.amount_cents,agent_standing:'eligible',
  owner_active:true,own_bid_exists:false,task_status:'bidding',task_is_simulated:false,
  currency:'USD',verified_budget_cents:900,verified_floor_cents:500,
  acceptance_criteria_complete:true,scope_sha256:intent.scope_sha256,
  proposal_sha256:intent.proposal_sha256,isolated_delivery_ready:true,
  incremental_cost_cents:0,deadline_feasible:true,reservation_conflict:false,
  nonce_previously_used:false,heartbeat_fresh:true,platform_quote_allowed:true
 };
 return {intent,evidence,nowSec:NOW+2,trustedCollectorContext:true};
};
test('NOVA: fully evidenced unescrowed job is a review candidate, NOT an approval',()=>{
 const r=simulateNovaExactBidReview(fixture());
 assert.equal(r.state,'candidate_for_separate_nova_signer');
 assert.equal(r.eligible_for_signer_review,true);assert.equal(r.can_submit,false);
 assert.equal(r.may_proceed,false);assert.equal(r.escrow_required,false);
 assert.equal(r.advisory_only,true);assert.ok(!('signature' in r));
});
test('NOVA: cannot replace Nova service authentication with evidence JSON',()=>{
 const x=fixture();x.trustedCollectorContext=false;
 const r=simulateNovaExactBidReview(x);
 assert.equal(r.state,'hold');assert.equal(r.reason,'trusted_private_collector_not_established');
});
test('NOVA: original #3298 uncertain bid never advances to review',()=>{
 const x=fixture();x.intent.problem_id='3298';
 const r=simulateNovaExactBidReview(x);
 assert.equal(r.reason,'invalid_or_legacy_intent');
});
test('NOVA: missing market evidence fails closed',()=>{
 const x=fixture();x.evidence=null;
 assert.equal(simulateNovaExactBidReview(x).reason,'independent_market_evidence_missing');
});
test('NOVA: expired exact intent fails closed even with otherwise valid evidence',()=>{
 const x=fixture();x.nowSec=NOW+900;
 assert.equal(simulateNovaExactBidReview(x).reason,'expired_or_untrusted_clock');
});
const mutations=[
 ['wrong task ID',x=>x.evidence.problem_id='9812','review_evidence_bound_to_different_bid'],
 ['wrong nonce',x=>x.evidence.nonce='d'.repeat(32),'review_evidence_bound_to_different_bid'],
 ['wrong quote',x=>x.evidence.amount_cents=800,'review_evidence_bound_to_different_bid'],
 ['wrong canonical intent',x=>x.evidence.canonical_intent='not-canonical','review_evidence_bound_to_different_bid'],
 ['untrusted source',x=>x.evidence.source='customer_json','collector_evidence_missing_or_stale'],
 ['stale detail',x=>x.evidence.collected_at_sec=NOW-200,'collector_evidence_missing_or_stale'],
 ['unapproved agent',x=>x.evidence.agent_standing='denied','agent_eligibility_or_existing_bid_unverified'],
 ['owner inactive',x=>x.evidence.owner_active=false,'agent_eligibility_or_existing_bid_unverified'],
 ['existing bid',x=>x.evidence.own_bid_exists=true,'agent_eligibility_or_existing_bid_unverified'],
 ['closed task',x=>x.evidence.task_status='awarded','task_closed_or_status_unknown'],
 ['simulated task',x=>x.evidence.task_is_simulated=true,'market_price_or_currency_unverified'],
 ['unknown currency',x=>x.evidence.currency=null,'market_price_or_currency_unverified'],
 ['budget missing',x=>x.evidence.verified_budget_cents=null,'market_price_or_currency_unverified'],
 ['budget below quote',x=>x.evidence.verified_budget_cents=600,'market_price_or_currency_unverified'],
 ['price floor above bid',x=>x.evidence.verified_floor_cents=900,'market_price_or_currency_unverified'],
 ['changed price after quote',x=>x.evidence.verified_budget_cents=1000,'market_price_or_currency_unverified'],
 ['acceptance incomplete',x=>x.evidence.acceptance_criteria_complete=false,'delivery_or_approval_scope_unverified'],
 ['changed proposal',x=>x.evidence.proposal_sha256='e'.repeat(64),'delivery_or_approval_scope_unverified'],
 ['changed scope',x=>x.evidence.scope_sha256='e'.repeat(64),'delivery_or_approval_scope_unverified'],
 ['delivery not isolated',x=>x.evidence.isolated_delivery_ready=false,'delivery_or_approval_scope_unverified'],
 ['incremental spend',x=>x.evidence.incremental_cost_cents=1,'delivery_or_approval_scope_unverified'],
 ['impossible deadline',x=>x.evidence.deadline_feasible=false,'delivery_or_approval_scope_unverified'],
 ['outstanding reservation',x=>x.evidence.reservation_conflict=true,'existing_reservation_or_replayed_nonce'],
 ['reused nonce',x=>x.evidence.nonce_previously_used=true,'existing_reservation_or_replayed_nonce'],
 ['heartbeat stale',x=>x.evidence.heartbeat_fresh=false,'heartbeat_or_platform_limits_unverified'],
 ['platform eligibility unknown',x=>x.evidence.platform_quote_allowed=false,'heartbeat_or_platform_limits_unverified']
];
for(const [name,mutation,reason]of mutations)test('NOVA: '+name+' fails closed',()=>{
 const x=fixture();mutation(x);
 const r=simulateNovaExactBidReview(x);
 assert.equal(r.state,'hold');assert.equal(r.reason,reason);
 assert.equal(r.can_submit,false);assert.equal(r.may_proceed,false);
});
test('NOVA: 2048 deterministic adverse evidence variants remain on hold',()=>{
 let seed=0x9ad75123;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 for(let i=0;i<2048;i++){
  const x=fixture(),m=mutations[random()%mutations.length];
  m[1](x);const r=simulateNovaExactBidReview(x);
  assert.equal(r.state,'hold',i+': '+m[0]);assert.equal(r.can_submit,false);
 }
});
test('NOVA: escrow metadata absent/present has no effect on candidate outcome',()=>{
 for(const status of [undefined,null,'none','held','pending']){
  const x=fixture();x.evidence.escrow_status=status;
  const r=simulateNovaExactBidReview(x);
  assert.equal(r.state,'candidate_for_separate_nova_signer');
  assert.equal(r.can_submit,false);
 }
});
