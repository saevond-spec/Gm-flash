import test from 'node:test';
import assert from 'node:assert/strict';
import {planSpriteMultiBidCycle,SPRITE_CAMPAIGN_LIMITS} from '../sprite-multi-bid-campaign.mjs';

const NOW=1800000000;
const task=(id,patch={})=>({
 problem_id:String(id),source:'authenticated_task_detail',verified:true,
 checked_at_sec:NOW-5,queue_source:'authenticated_bid_queue',
 queue_checked_at_sec:NOW-5,posted_at_sec:NOW-1000,
 status:'open',currency:'USD',simulated:false,self_owned:false,
 quote_cents:650,budget_cents:1000,floor_cents:500,
 own_bid_exists:false,existing_reservation:false,escrow_status:'held',
 acceptance_criteria_verified:true,acceptance_coverage_verified:true,
 isolated_delivery_verified:true,fictional_rehearsal_passed:true,
 zero_incremental_cost:true,deadline_feasible:true,estimated_minutes:60,
 ...patch
});
const fixture=(patch={})=>({
 nowSec:NOW,
 agent:{source:'authenticated_me',verified:true,agent_id:1878,
  admission_status:'approved',owner_active:true,checked_at_sec:NOW-4},
 standing:{source:'authenticated_standing',verified:true,held_back:false,
  account_paused:false,checked_at_sec:NOW-4},
 criteria:{source:'official_criteria',verified:true,
  heartbeat_window_sec:300,checked_at_sec:NOW-4},
 heartbeat:{agent_id:1878,status:200,ack_sec:NOW-10},
 capacity:{verified:true,checked_at_sec:NOW-3,open_orders:0,allowed_open_orders:1},
 reservations:[{agent_id:1878,problem_id:'3298',state:'uncertain'}],
 candidates:[task(9002),task(9001,{posted_at_sec:NOW-2000})],...patch
});
test('simulated campaign produces ONE advisory candidate and ZERO writes',()=>{
 const r=planSpriteMultiBidCycle(fixture());
 assert.equal(r.state,'candidate_for_independent_approval_only');
 assert.equal(r.can_submit,false);
 assert.equal(r.marketplace_posts,0);
 assert.equal(r.recommendations.length,1);
 assert.equal(r.recommendations[0].problem_id,'9001'); // oldest first
 assert.equal(r.recommendations[0].payout_if_settled_cents,487);
 assert.equal(r.recommendations[0].predicted_win_probability,null);
});
test('legacy uncertain reservation #3298 remains quarantined while other jobs can be reviewed',()=>{
 const r=planSpriteMultiBidCycle(fixture());
 assert.equal(r.recommendations[0].problem_id,'9001');
 assert.equal(SPRITE_CAMPAIGN_LIMITS.legacy_quarantine_id,'3298');
});
test('one fresh unresolved NEW transport blocks all further bidding recommendations',()=>{
 for(const state of ['uncertain','reserved']){
  const x=fixture({reservations:[{agent_id:1878,problem_id:'3298',state:'uncertain'},
   {agent_id:1878,problem_id:'9011',state}]});
  const r=planSpriteMultiBidCycle(x);
  assert.equal(r.state,'new_bid_receipt_unresolved');
  assert.equal(r.marketplace_posts,0);
 }
});
test('only authoritative independent reconciler may mark a new bid confirmed',()=>{
 const x=fixture({reservations:[
  {agent_id:1878,problem_id:'3298',state:'uncertain'},
  {agent_id:1878,problem_id:'9001',state:'confirmed'}
 ]});
 const r=planSpriteMultiBidCycle(x);
 assert.equal(r.recommendations[0].problem_id,'9002');
});
test('conflicting duplicate task snapshots cannot be promoted',()=>{
 const x=fixture({candidates:[task(9100),task(9100,{floor_cents:800}),task(9101)]});
 const r=planSpriteMultiBidCycle(x);
 assert.equal(r.recommendations[0].problem_id,'9101');
 assert.deepEqual(r.conflicting_task_ids,['9100']);
});
test('missing evidence fails closed',()=>{
 const cases=[
  {agent:{...fixture().agent,agent_id:999}},
  {standing:{...fixture().standing,held_back:true}},
  {criteria:{...fixture().criteria,checked_at_sec:NOW-301}},
  {heartbeat:{agent_id:1878,status:200,ack_sec:NOW-1000}},
  {capacity:{...fixture().capacity,open_orders:1}},
  {reservations:null},
  {candidates:null},
 ];
 for(const patch of cases){
  const r=planSpriteMultiBidCycle(fixture(patch));
  assert.equal(r.can_submit,false);
  assert.equal(r.recommendations.length,0);
  assert.equal(r.marketplace_posts,0);
 }
});
test('reject unknown budgets, floor, stale details and unsupported scope',()=>{
 const patches=[
 {budget_cents:null},{floor_cents:null},{floor_cents:900,quote_cents:650},
 {quote_cents:2500},{currency:'EUR'},{simulated:true},
 {escrow_status:'unknown'},{status:'completed'},
 {self_owned:true},{own_bid_exists:true},{existing_reservation:true},
 {checked_at_sec:NOW-301},{queue_checked_at_sec:NOW-301},
 {zero_incremental_cost:false},{acceptance_coverage_verified:false},
 {isolated_delivery_verified:false},{estimated_minutes:500},
 {fictional_rehearsal_passed:false},{deadline_feasible:false},
 ];
 for(const patch of patches){
  const r=planSpriteMultiBidCycle(fixture({candidates:[task(9999,patch)]}));
  assert.equal(r.state,'no_independently_screened_candidate',JSON.stringify(patch));
  assert.equal(r.marketplace_posts,0);
 }
});
test('explicitly unescrowed task may be considered for independent bid authorization',()=>{
 for(const status of ['none','unfunded']){
  const r=planSpriteMultiBidCycle(fixture({candidates:[task(9101,{escrow_status:status})]}));
  assert.equal(r.state,'candidate_for_independent_approval_only');
  assert.equal(r.recommendations[0].payment_protection,'unfunded_or_unprotected');
  assert.equal(r.recommendations[0].buyer_payment_risk,'high');
  assert.equal(r.recommendations[0].delivery_requires_funding_verification,true);
  assert.equal(r.marketplace_posts,0);assert.equal(r.can_submit,false);
 }
});
test('funded tasks are ranked ahead of explicitly unfunded tasks; both remain eligible',()=>{
 const r=planSpriteMultiBidCycle(fixture({candidates:[
  task(9101,{escrow_status:'none',posted_at_sec:NOW-8000}),
  task(9102,{escrow_status:'held',posted_at_sec:NOW-1000})]}));
 assert.equal(r.recommendations[0].problem_id,'9102');
 assert.equal(r.recommendations[0].payment_protection,'posting_hold_reported_not_payout_guarantee');
});
test('unfunded status alone does not excuse missing official budget, quote, floor or scope proof',()=>{
 for(const patch of [{budget_cents:null},{floor_cents:null},{quote_cents:2500},
   {accepted_criteria_verified:false},{acceptance_coverage_verified:false},
   {checked_at_sec:NOW-400},{source:'buyer_text'}]){
  const r=planSpriteMultiBidCycle(fixture({candidates:[task(9103,{escrow_status:'none',...patch})]}));
  if(!('accepted_criteria_verified' in patch))
   assert.equal(r.recommendations.length,0);
 }
});
test('20 otherwise eligible tasks still yield one candidate per dispatch cycle',()=>{
 const candidates=Array.from({length:20},(_,i)=>task(9500+i,{posted_at_sec:NOW-600-i}));
 const r=planSpriteMultiBidCycle(fixture({candidates}));
 assert.equal(r.recommendations.length,1);
 assert.equal(r.can_submit,false);
 assert.equal(r.marketplace_posts,0);
});
test('unknown reservation state and unsafe alteration of legacy quarantine fail closed',()=>{
 const cases=[
 [{agent_id:1878,problem_id:'3298',state:'confirmed'}],
 [{agent_id:1878,problem_id:'5555',state:'deleted'}],
 [{agent_id:100,problem_id:'3298',state:'uncertain'}]
 ];
 for(const reservations of cases)
  assert.equal(planSpriteMultiBidCycle(fixture({reservations})).state,
   reservations[0].problem_id==='3298'&&reservations[0].agent_id===1878?
   'legacy_quarantine_integrity_failed':'ledger_state_invalid');
});
test('seeded adversarial scans never return more than one recommendation or authorize POST',()=>{
 let s=0x2d8f342a;
 const next=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return s>>>0};
 for(let run=0;run<128;run++){
  const candidates=Array.from({length:18},(_,i)=>{
   const x=next();
   return task(20000+i,{quote_cents:500+(x%16)*100,
    budget_cents:2000,floor_cents:500,
    escrow_status:(x%5===0)?'none':'held',
    verified:(x%9!==0),posted_at_sec:NOW-(x%10000)-1});
  });
  const r=planSpriteMultiBidCycle(fixture({candidates}));
  assert.equal(r.can_submit,false);
  assert.equal(r.marketplace_posts,0);
  assert.ok(r.recommendations.length<=1);
 }
});
