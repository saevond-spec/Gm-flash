import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSpriteDirectPrebid as review} from '../sprite-direct-prebid.mjs';
const now=Date.parse('2026-11-26T07:14:00Z');
const agent=()=>({id:1878,authenticated:true,admission_status:'approved',
  webhook_matches_approved_sprite:true});
const task=(other={})=>({
  id:'9876543',authenticated:true,identity_verified:true,
  fetched_at:'2026-11-26T07:12:00Z',status:'bidding',currency:'USD',
  simulated:false,escrow_status:'funded',price:12500,
  deadline:'2026-12-02T12:00:00Z',...other
});
const proposal=(other={})=>({
  task_id:'9876543',amount_cents:8000,additional_spend_cents:0,
  capability_verified:true,can_deliver_public_brief:true,
  approach:'Produce a reproducible public-data summary with cited primary sources and complete checkable outputs.',
  verification_plan:'Compare each finding against primary public references and verify the report is internally consistent.',
  buyer_message:'I can deliver a sourced public report with verification and a clear turnaround.',
  estimated_hours:12,...other
});
const run=(a={},t={},p={},o={})=>review({
  agent:agent(),task:task(t),proposal:proposal(p),existing:{},
  delegated:true,nowMs:now,...o,agent:{...agent(),...a}
});
test('credible bid passes WITHOUT old readiness rows, council vote or workspace',()=>{
  const x=run();
  assert.equal(x.prebid_feasible,true);
  assert.equal(x.requires_archived_readiness_row,false);
  assert.equal(x.requires_council_vote,false);
  assert.equal(x.requires_prebid_workspace_attestation,false);
  assert.equal(x.requires_prebid_scope_mapping,false);
  assert.equal(x.requires_post_award_customer_workspace,true);
  assert.equal(x.requires_post_award_scope_review,true);
  assert.equal(x.bid_submitted,false);
  assert.equal(x.requires_authenticated_single_send,true);
  assert.equal(x.requires_marketplace_receipt_readback,true);
});
test('no escrow is acceptable for bid review but payment not guaranteed',()=>{
  const x=run({}, {escrow_status:'none',price:0,reference_price:12500,escrow_funded:false});
  assert.equal(x.prebid_feasible,true);
  assert.equal(x.funding_risk,'no_escrow_not_guaranteed');
});
test('null escrow field is not a permitted funding mode',()=>{
  assert.ok(run({},{escrow_status:null}).reasons.includes('funding_mode_unknown'));
});
test('reported funded is not mislabeled confirmed money',()=>{
  assert.equal(run().funding_risk,'reported_funded_not_settlement_guarantee');
});
test('unknown simulation flag requires external proof',()=>{
  assert.ok(run({},{simulated:null}).reasons.includes('simulation_authenticity_not_verified'));
});
test('fresh authenticated explicit real public evidence may complete missing flag',()=>{
  const x=run({},{simulated:null},{},{publicEvidence:{
    authenticated:true,task_id:'9876543',explicit_non_simulated_verified:true,
    verified_at:'2026-11-26T07:13:00Z'
  }});
  assert.equal(x.prebid_feasible,true);
});
test('stale public authenticity evidence is not enough',()=>{
  assert.ok(run({},{simulated:null},{},{publicEvidence:{
    authenticated:true,task_id:'9876543',explicit_non_simulated_verified:true,
    verified_at:'2026-11-26T04:13:00Z'
  }}).reasons.includes('simulation_authenticity_not_verified'));
});
test('public-page simulation banner beats an authenticated false field',()=>{
  assert.ok(run({},{},{},{publicEvidence:{simulated_bounty_banner:true}})
    .reasons.includes('simulated_or_nonpaying_bounty'));
});
test('integer simulated 1 blocks candidate',()=>{
  assert.ok(run({},{simulated:1}).reasons.includes('simulated_or_nonpaying_bounty'));
});
test('unauthenticated task cannot be approved',()=>{
  assert.ok(run({},{authenticated:false}).reasons.includes('authentic_task_detail_unavailable'));
});
test('task detail too old fails',()=>{
  assert.ok(run({},{fetched_at:'2026-11-26T05:12:00Z'}).reasons.includes('task_detail_not_fresh'));
});
test('wrong agent cannot enter fast submission',()=>{
  assert.ok(run({id:1978}).reasons.includes('sprite_identity_unverified'));
});
test('unapproved identity cannot enter fast submission',()=>{
  assert.ok(run({admission_status:'pending'}).reasons.includes('sprite_identity_unverified'));
});
test('wrong webhook blocks impersonation',()=>{
  assert.ok(run({webhook_matches_approved_sprite:false}).reasons.includes('sprite_identity_unverified'));
});
test('unknown/crossed currency fails',()=>{
  assert.ok(run({},{currency:'EUR'}).reasons.includes('currency_not_usd'));
});
test('closed job not biddable',()=>{
  assert.ok(run({},{status:'closed'}).reasons.includes('task_not_open'));
});
test('proposal task mismatches actual task',()=>{
  assert.ok(run({},{},{task_id:'1111'}).reasons.includes('proposal_task_mismatch'));
});
test('duplicate local reservation prevents repeated bid',()=>{
  assert.ok(run({},{},{},{existing:{reservation:true}}).reasons.includes('existing_bid_or_uncertain_receipt'));
});
test('own marketplace bid prevents repeated send even absent local receipt',()=>{
  assert.ok(run({},{},{},{existing:{own_marketplace_bid:true}}).reasons.includes('existing_bid_or_uncertain_receipt'));
});
test('uncertain receipt cannot be automatically retried',()=>{
  assert.ok(run({},{},{},{existing:{uncertain:true}}).reasons.includes('existing_bid_or_uncertain_receipt'));
});
test('explicit approved delegation required for autonomous path',()=>{
  assert.ok(run({},{},{},{delegated:false}).reasons.includes('sprite_autonomous_delegation_missing'));
});
test('fee and spend do not leave zero-cost policy',()=>{
  assert.ok(run({},{},{additional_spend_cents:1}).reasons.includes('nonzero_additional_spending'));
});
test('quote must not exceed executable ceiling',()=>{
  assert.ok(run({},{},{amount_cents:100001}).reasons.includes('price_outside_verified_bounds'));
});
test('quote must not exceed buyer public budget',()=>{
  assert.ok(run({},{},{amount_cents:18000}).reasons.includes('price_outside_verified_bounds'));
});
test('quote may not be below the approved floor',()=>{
  assert.ok(run({},{},{amount_cents:1999}).reasons.includes('price_outside_verified_bounds'));
});
test('missing approach is not an adequate bid plan',()=>{
  assert.ok(run({},{},{approach:'hey'}).reasons.includes('meaningful_delivery_plan_missing'));
});
test('missing verification plan blocks unsupported capability claim',()=>{
  assert.ok(run({},{},{verification_plan:'ok'}).reasons.includes('meaningful_delivery_plan_missing'));
});
test('declared delivery capability required',()=>{
  assert.ok(run({},{},{capability_verified:false}).reasons.includes('delivery_capability_not_verified'));
});
test('unreasonable hours blocked',()=>{
  assert.ok(run({},{},{estimated_hours:169}).reasons.includes('delivery_time_invalid'));
});
test('impossible deadline blocked',()=>{
  assert.ok(run({},{deadline:'2026-11-26T12:00:00Z'}).reasons.includes('deadline_not_feasible'));
});
test('invalid buyer message blocks',()=>{
  assert.ok(run({},{},{buyer_message:'hi'}).reasons.includes('buyer_message_invalid'));
});
test('default result has no buyer data, secrets or proposal text',()=>{
  const x=run({}, {description:'SECRET BUYER DOCUMENT'},
    {buyer_message:'SECRET PRIVATE TOKEN INCLUDED IN BUYER MESSAGE WITH OTHER TEXT'});
  const t=JSON.stringify(x);
  assert.ok(!t.includes('SECRET BUYER DOCUMENT'));
  assert.ok(!t.includes('SECRET PRIVATE TOKEN'));
});
test('an invalid clock prevents falsely approving future events',()=>{
  assert.ok(run({},{},{},{nowMs:0}).reasons.includes('clock_unverified'));
});
test('a forged funded-escrow state does not pass contradictory fields',()=>{
  assert.ok(run({},{escrow_funded:false}).reasons.includes('funding_fields_conflict'));
});
