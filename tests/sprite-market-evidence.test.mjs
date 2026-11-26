import test from 'node:test';
import assert from 'node:assert/strict';
import {assessPublicTaskAuthenticity as verify} from '../sprite-market-evidence.mjs';
const now=Date.parse('2026-11-26T07:00:00Z');
const task=(over={})=>({
  id:2690,authenticated:true,fetched_at:'2026-11-26T06:59:00Z',status:'bidding',
  currency:'USD',simulated:false,escrow_status:'funded',price:17500,
  reference_price:17500,escrow_amount:17500,...over
});
const inventory=(over={})=>({problem_id:'2690',budget_cents:17500,simulated:null,escrow_status:'funded',...over});
const scan=(taskOver={},invOver={},options={})=>verify({
  inventory:inventory(invOver),authenticatedTask:task(taskOver),
  nowMs:now,quoteCents:12000,...options
});
test('public-review candidate may be reported funded, never bid-authorized',()=>{
  const r=scan();assert.equal(r.state,'funded_reported_reviewable');
  assert.equal(r.reviewable,true);assert.equal(r.bid_authorized,false);
  assert.equal(r.escrow_guaranteed,false);
  assert.equal(r.detailed_scope_review_stage,'post_award');
});
test('no-escrow tasks remain reviewable, with explicit payment risk',()=>{
  const r=scan({escrow_status:'none',price:0,reference_price:17500,escrow_amount:0});
  assert.equal(r.state,'no_escrow_reviewable');
  assert.equal(r.funding_kind,'unfunded_no_escrow');
  assert.equal(r.escrow_guaranteed,false);
});
test('authenticated simulated task rejected',()=>assert.equal(scan({simulated:true}).state,'simulated'));
test('cached simulated task rejected',()=>assert.equal(scan({}, {simulated:true}).state,'simulated')); 
test('public simulation warning quarantines contradictions',()=>{
  const r=scan({}, {}, {publicPage:{simulated_bounty_banner:true}});
  assert.equal(r.state,'evidence_conflict');
  assert.ok(r.reasons.includes('public_marketplace_simulation_warning'));
});
test('null simulation evidence does not prove a paying job',()=>{
  const r=scan({simulated:null});assert.equal(r.state,'simulation_unknown');assert.equal(r.reviewable,false);
});
test('fresh authenticated detail required',()=>assert.equal(scan({fetched_at:'2026-11-26T04:00:00Z'}).state,'needs_fresh_authoritative_detail'));
test('unauthenticated API detail not trusted',()=>assert.equal(scan({authenticated:false}).state,'needs_fresh_authoritative_detail'));
test('future detail rejected',()=>assert.equal(scan({fetched_at:'2026-11-26T08:00:00Z'}).state,'needs_fresh_authoritative_detail'));
test('wrong task ID blocked',()=>assert.equal(scan({id:2691}).state,'invalid'));
test('missing authenticated task ID blocked',()=>assert.equal(scan({id:null}).state,'invalid'));
test('closed task rejected',()=>assert.equal(scan({status:'closed'}).state,'not_biddable'));
test('unsupported currency rejected',()=>assert.equal(scan({currency:'EUR'}).state,'price_unverified'));
test('funded task with conflicting escrow amount blocked',()=>assert.equal(scan({escrow_amount:14500}).state,'price_unverified'));
test('funded task with nonpayment flag blocked',()=>assert.equal(scan({escrow_funded:false}).state,'evidence_conflict'));
test('no-escrow task with contradictory held-money flag blocked',()=>assert.equal(scan({escrow_status:'none',price:0,escrow_funded:true}).state,'evidence_conflict'));
test('no-escrow task requires reference price',()=>assert.equal(scan({escrow_status:'none',price:0,reference_price:null,escrow_amount:0}).state,'price_unverified'));
test('unknown escrow status does not make it funded',()=>assert.equal(scan({escrow_status:'unknown'}).state,'funding_unknown'));
test('credits units mismatch blocks verified price',()=>assert.equal(scan({price_credits:173}).state,'price_unverified'));
test('quote above executable range rejected',()=>assert.equal(scan({}, {}, {quoteCents:150000}).state,'price_unverified'));
test('quote below minimum rejected',()=>assert.equal(scan({}, {}, {quoteCents:1999}).state,'price_unverified'));
test('quote above buyer budget rejected',()=>assert.equal(scan({}, {}, {quoteCents:90000}).state,'price_unverified'));
test('invalid time config fails closed',()=>assert.equal(scan({}, {}, {nowMs:0}).state,'invalid'));
test('no customer content or credentials emitted',()=>{
  const r=scan({description:'CUSTOMER PRIVATE DETAILS',api_key:'TEST-KEY',
    buyer_message:'BUYER SECRET',proposal:'SENSITIVE TEXT'}, {client_notes:'CLIENT FILE'});
  const out=JSON.stringify(r);
  for(const s of ['CUSTOMER PRIVATE DETAILS','TEST-KEY','BUYER SECRET','SENSITIVE TEXT','CLIENT FILE'])assert.ok(!out.includes(s));
});
test('missing task data fails closed',()=>{
  const r=verify({inventory:inventory(),authenticatedTask:null,nowMs:now});
  assert.equal(r.state,'invalid');
});


test('numeric simulated=1 in D1 blocks an apparently funded listing',()=>{
  assert.equal(scan({}, {simulated:1}).state,'simulated');
});
test('numeric is_simulated=1 from API blocks candidate',()=>{
  assert.equal(scan({simulated:undefined,is_simulated:1}).state,'simulated');
});
test('numeric is_simulated=0 is explicit real evidence',()=>{
  assert.equal(scan({simulated:undefined,is_simulated:0}).state,'funded_reported_reviewable');
});
test('conflicting true and false simulation indicators fail closed',()=>{
  assert.equal(scan({simulated:false,is_simulation:1}).state,'simulated');
});
test('no-escrow does not promise real escrow after numeric real flag',()=>{
  const r=scan({simulated:undefined,is_simulated:0,escrow_status:'unfunded',price:0,escrow_amount:0});
  assert.equal(r.state,'no_escrow_reviewable');
  assert.equal(r.escrow_guaranteed,false);
});
