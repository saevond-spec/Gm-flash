import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPublicReviewCandidates as select,assessBidStageEvidence} from '../sprite-review-queue.mjs';
const now=Date.parse('2026-11-26T06:00:00Z');
const listing=(problem_id,extra={})=>({
  problem_id:String(problem_id),task_status:'bidding',escrow_status:'funded',
  budget_cents:5000,simulated:null,category:'data',
  last_seen_at:'2026-11-26T05:55:00Z',...extra
});
const run=(rows,opts={})=>select(rows,{nowMs:now,...opts});
test('blocked first eight never starve a fresh ninth',()=>{
  const eight=Array.from({length:8},(_,i)=>listing(i+1));
  assert.deepEqual(run([...eight,listing(99)],{reservationIds:eight.map(x=>x.problem_id)}).candidates.map(x=>x.problem_id),['99']);
});
test('cooldown exclusions precede review limit',()=>{
  const rows=[...Array.from({length:20},(_,i)=>listing(i+1)),listing(500)];
  const cooldowns=new Map(rows.slice(0,20).map(x=>[x.problem_id,now+1000]));
  assert.deepEqual(run(rows,{cooldowns,limit:8}).candidates.map(x=>x.problem_id),['500']);
});
test('own bids, reservations and receipts excluded',()=>{
  const r=run([1,2,3,4].map(i=>listing(i)),{reservationIds:['1'],receiptIds:['2'],ownBidPresenceIds:['3']});
  assert.deepEqual(r.candidates.map(x=>x.problem_id),['4']);
});
test('explicit simulations excluded, unknown simulations not certified',()=>{
  const r=run([listing(1,{simulated:true}),listing(2,{simulated:1}),listing(3)]);
  assert.equal(r.candidates.length,1);
  assert.equal(r.candidates[0].simulation_evidence,'unknown_requires_verification');
  assert.equal(r.candidates[0].bid_ready,false);
});
test('unknown escrow excluded; none allowed for review',()=>{
  assert.deepEqual(run([listing(1,{escrow_status:'unknown'}),listing(2,{escrow_status:'none'})])
    .candidates.map(x=>x.problem_id),['2']);
});
test('expired and future timestamps excluded',()=>{
  assert.deepEqual(run([listing(1,{last_seen_at:'2026-11-26T04:00:00Z'}),
    listing(2,{last_seen_at:'2026-11-26T07:00:00Z'}),listing(3)])
    .candidates.map(x=>x.problem_id),['3']);
});
test('missing or negative observed price excluded',()=>{
  assert.deepEqual(run([listing(1,{budget_cents:null}),listing(2,{budget_cents:-1}),listing(3)])
    .candidates.map(x=>x.problem_id),['3']);
});
test('malformed records fail closed without batch crash',()=>{
  assert.deepEqual(run([null,undefined,[],{},listing(0),listing('INVALID'),listing(7)])
    .candidates.map(x=>x.problem_id),['7']);
});
test('category-fair scheduling avoids category monopolization',()=>{
  const rows=[...Array.from({length:9},(_,i)=>listing(i+1)),
    listing(99,{category:'other'}),listing(100,{category:'api'})];
  assert.deepEqual(run(rows,{limit:3}).candidates.map(x=>x.category),['data','api','other']);
});
test('ranking is deterministic under reversed input order',()=>{
  const rows=[listing(8,{budget_cents:8100}),listing(7,{budget_cents:8300}),listing(6,{budget_cents:8900})];
  assert.deepEqual(run(rows).candidates,run([...rows].reverse()).candidates);
});
test('discovery never sends a bid or certifies readiness',()=>{
  const r=run([listing(10)]);
  assert.equal(r.candidates[0].bid_ready,false);
  assert.equal(r.diagnostics.bid_submissions,0);
});
test('12,000-record blocked-prefix starvation regression',()=>{
  const rows=Array.from({length:12000},(_,i)=>listing(i+1));
  const r=run(rows,{reservationIds:rows.slice(0,11990).map(x=>x.problem_id),limit:8});
  assert.equal(r.candidates.length,8);
  assert.equal(r.diagnostics.excluded.already_bid_reserved_or_blocked,11990);
});
test('duplicate ID is reviewed at most once',()=>{
  assert.deepEqual(run([listing(55),listing(55),listing(56)])
    .candidates.map(x=>x.problem_id),['55','56']);
});
test('prebid evidence does not require a delivery workspace',()=>{
  const pass={};for(const k of ['approved_sprite_identity','fresh_task_identity',
    'authenticated_marketplace_authenticity_verified','public_scope_feasibility_screen','demonstrated_delivery_capability',
    'zero_additional_spend_plan','verified_price_and_deadline','accurate_complete_proposal',
    'clear_duplicate_and_uncertain_status','authorized_bid_submission'])pass[k]=true;
  const result=assessBidStageEvidence(pass);
  assert.equal(result.ready,true);
  assert.equal(result.workspace_attestation_is_prebid_requirement,false);
  assert.equal(result.delivery_workspace_required_after_award,true);
  assert.equal(result.scope_review_stage,'post_award');
  assert.equal(result.detailed_scope_review_required_before_delivery,true);
  assert.equal(result.can_begin_customer_delivery,false);
});
test('missing evidence fails closed',()=>{
  const result=assessBidStageEvidence({approved_sprite_identity:true});
  assert.equal(result.ready,false);
  assert.ok(result.missing.includes('clear_duplicate_and_uncertain_status'));
});
test('untrusted record body and secrets are not returned',()=>{
  const r=run([listing(1,{description:'CUSTOMER SECRET',cph_api_key:'BAD',proposal:'BUYER DOC',
    previous_review:'customer private info'})]);
  assert.ok(!JSON.stringify(r).includes('CUSTOMER SECRET'));
  assert.ok(!JSON.stringify(r).includes('BAD'));
  assert.ok(!JSON.stringify(r).includes('BUYER DOC'));
  assert.ok(!JSON.stringify(r).includes('customer private info'));
});
test('invalid scheduler configuration fails closed',()=>{
  assert.throws(()=>run([listing(1)],{limit:0}),RangeError);
  assert.throws(()=>run([listing(1)],{maxAgeMs:Infinity}),RangeError);
});


test('fresh duplicate survives an earlier stale record',()=>{
  const r=run([
    listing(808,{last_seen_at:'2026-11-26T02:00:00Z'}),
    listing(808,{last_seen_at:'2026-11-26T05:59:00Z'})
  ]);
  assert.deepEqual(r.candidates.map(x=>x.problem_id),['808']);
  assert.equal(r.candidates[0].last_seen_at,'2026-11-26T05:59:00.000Z');
});
test('latest duplicate simulated evidence overrides an older live listing',()=>{
  const r=run([
    listing(809,{simulated:null,last_seen_at:'2026-11-26T05:50:00Z'}),
    listing(809,{simulated:true,last_seen_at:'2026-11-26T05:59:00Z'})
  ]);
  assert.equal(r.candidates.length,0);
  assert.equal(r.diagnostics.excluded.explicit_simulation,1);
});

test('prebid screen does not require full award-stage acceptance mapping',()=>{
  const x={};for(const name of ['approved_sprite_identity','fresh_task_identity','authenticated_marketplace_authenticity_verified',
    'public_scope_feasibility_screen','demonstrated_delivery_capability',
    'zero_additional_spend_plan','verified_price_and_deadline','accurate_complete_proposal',
    'clear_duplicate_and_uncertain_status','authorized_bid_submission'])x[name]=true;
  assert.equal(assessBidStageEvidence(x).ready,true);
  assert.equal(assessBidStageEvidence(x).scope_review_stage,'post_award');
});
test('prebid screen still rejects obvious scope or delivery mismatch',()=>{
  const x={};for(const name of ['approved_sprite_identity','fresh_task_identity','authenticated_marketplace_authenticity_verified',
    'public_scope_feasibility_screen','demonstrated_delivery_capability',
    'zero_additional_spend_plan','verified_price_and_deadline','accurate_complete_proposal',
    'clear_duplicate_and_uncertain_status','authorized_bid_submission'])x[name]=true;
  x.public_scope_feasibility_screen=false;
  assert.ok(assessBidStageEvidence(x).missing.includes('public_scope_feasibility_screen'));
});

test('unknown simulation evidence cannot pass prebid gate',()=>{
  const x={};for(const k of ['approved_sprite_identity','fresh_task_identity',
    'authenticated_marketplace_authenticity_verified','public_scope_feasibility_screen',
    'demonstrated_delivery_capability','zero_additional_spend_plan',
    'verified_price_and_deadline','accurate_complete_proposal',
    'clear_duplicate_and_uncertain_status','authorized_bid_submission'])x[k]=true;
  x.authenticated_marketplace_authenticity_verified=false;
  assert.ok(assessBidStageEvidence(x).missing.includes('authenticated_marketplace_authenticity_verified'));
});
test('post-award detailed scope is not required to prebid when authenticity verified',()=>{
  const x={};for(const k of ['approved_sprite_identity','fresh_task_identity',
    'authenticated_marketplace_authenticity_verified','public_scope_feasibility_screen',
    'demonstrated_delivery_capability','zero_additional_spend_plan',
    'verified_price_and_deadline','accurate_complete_proposal',
    'clear_duplicate_and_uncertain_status','authorized_bid_submission'])x[k]=true;
  assert.equal(assessBidStageEvidence(x).ready,true);
  assert.equal(assessBidStageEvidence(x).detailed_scope_review_required_before_delivery,true);
});
