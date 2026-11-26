import test from 'node:test';
import assert from 'node:assert/strict';
import {submitSpriteDirectOnce as send} from '../sprite-direct-bid-orchestrator.mjs';
const now=Date.parse('2026-11-26T07:16:00Z');
const agent=()=>({id:1878,authenticated:true,admission_status:'approved',webhook_matches_approved_sprite:true});
const task=(override={})=>({
  id:'12345',authenticated:true,identity_verified:true,public_only_brief_verified:true,
  fetched_at:'2026-11-26T07:15:00Z',status:'bidding',currency:'USD',
  simulated:false,escrow_status:'funded',price:15000,deadline:'2026-12-01T19:00:00Z',...override
});
const proposal=(override={})=>({
  task_id:'12345',amount_cents:10000,additional_spend_cents:0,capability_verified:true,
  can_deliver_public_brief:true,estimated_hours:12,
  approach:'Deliver an independently checkable public-only research report using reproducible methods.',
  verification_plan:'Verify the final claims against public primary sources and a repeatable checklist.',
  buyer_message:'I can deliver the public work with a documented method and verification evidence.',
  ...override
});
const receipt=(override={})=>({agent_id:1878,problem_id:'12345',amount_cents:10000,
  bid_id:'bid-12345',status:'pending',...override});
function deps(overrides={}){
  let calls={read:0,proposals:0,sends:0,receipts:0};
  const routines={
    getSpriteIdentity:async()=>agent(),
    getAuthenticatedTask:async(id)=>{calls.read++;return task()},
    getPublicAuthenticityEvidence:async()=>({}),
    getOwnBidHistory:async()=>({authoritative:true,reservation:false,receipt:false,uncertain:false,
      own_marketplace_bid:false}),
    createPublicOnlyProposal:async()=>{calls.proposals++;return proposal()},
    reserveAndSendOnce:async()=>{calls.sends++;return {outcome:'posted',attempted:true}},
    readAuthenticatedBidReceipt:async()=>{calls.receipts++;return receipt()}
  };
  return {api:{...routines,...overrides},calls};
}
const run=({overrides={},opts={}}={})=>{
  const ctx=deps(overrides);
  return {ctx,result:send({problem_id:'12345',deps:ctx.api,nowMs:now,delegated:true,...opts})};
};
test('direct fast path submits once and confirms exact marketplace receipt',async()=>{
  const {ctx,result}=run();const r=await result;
  assert.equal(r.state,'authenticated_bid_confirmed');
  assert.equal(r.confirmed,true);assert.equal(ctx.calls.sends,1);
  assert.equal(ctx.calls.receipts,1);
});
test('no required council, archived readiness or customer workspace function',async()=>{
  const {result}=run();assert.equal((await result).confirmed,true);
});
test('approved no-escrow bid is allowed with same controls',async()=>{
  const {result}=run({overrides:{getAuthenticatedTask:async()=>task({
    escrow_status:'none',reference_price:15000,price:0,escrow_funded:false})}});
  assert.equal((await result).confirmed,true);
});
test('simulated jobs never reach proposal generation or POST',async()=>{
  const {ctx,result}=run({overrides:{getAuthenticatedTask:async()=>task({simulated:1})}});
  assert.equal((await result).state,'simulated_bounty_excluded');
  assert.equal(ctx.calls.proposals,0);assert.equal(ctx.calls.sends,0);
});
test('public simulated banner prevents model/prompt work',async()=>{
  const {ctx,result}=run({overrides:{
    getPublicAuthenticityEvidence:async()=>({simulated_bounty_banner:true})}});
  assert.equal((await result).state,'simulated_bounty_excluded');
  assert.equal(ctx.calls.proposals,0);
});
test('previous bid rejects before proposal or another POST',async()=>{
  const {ctx,result}=run({overrides:{
    getOwnBidHistory:async()=>({authoritative:true,receipt:true})}});
  assert.equal((await result).state,'existing_bid_requires_reconciliation');
  assert.equal(ctx.calls.proposals,0);
});
test('uncertain prior submission cannot be retried',async()=>{
  const {ctx,result}=run({overrides:{
    getOwnBidHistory:async()=>({authoritative:true,uncertain:true})}});
  assert.equal((await result).state,'existing_bid_requires_reconciliation');
  assert.equal(ctx.calls.sends,0);
});
test('unverified own bid history fails closed',async()=>{
  const {ctx,result}=run({overrides:{getOwnBidHistory:async()=>null}});
  assert.equal((await result).state,'own_bid_history_unverified');
  assert.equal(ctx.calls.sends,0);
});
test('missing public isolation proof prevents proposal generation',async()=>{
  const {ctx,result}=run({overrides:{
    getAuthenticatedTask:async()=>task({public_only_brief_verified:false})}});
  assert.equal((await result).state,'public_brief_isolation_unverified');
  assert.equal(ctx.calls.proposals,0);
});
test('failed identity prevents model and submission',async()=>{
  const {ctx,result}=run({overrides:{
    getSpriteIdentity:async()=>({...agent(),id:1999})}});
  assert.equal((await result).state,'identity_or_listing_unverified');
  assert.equal(ctx.calls.sends,0);
});
test('missing autonomy delegation blocks all calls',async()=>{
  const {ctx,result}=run({opts:{delegated:false}});
  assert.equal((await result).state,'configuration_or_delegation_missing');
  assert.equal(ctx.calls.read,0);assert.equal(ctx.calls.sends,0);
});
test('incorrect task identity blocks action',async()=>{
  const {ctx,result}=run({overrides:{getAuthenticatedTask:async()=>task({id:'54321'})}});
  assert.equal((await result).state,'identity_or_listing_unverified');
  assert.equal(ctx.calls.sends,0);
});
test('read failure fails without attempting send',async()=>{
  const {ctx,result}=run({overrides:{getAuthenticatedTask:async()=>{throw Error('network')}}});
  assert.equal((await result).state,'authoritative_read_unavailable');
  assert.equal(ctx.calls.sends,0);
});
test('proposal failure fails without attempting send',async()=>{
  const {ctx,result}=run({overrides:{createPublicOnlyProposal:async()=>{throw Error('model')}}});
  assert.equal((await result).state,'public_proposal_unavailable');
  assert.equal(ctx.calls.sends,0);
});
test('unknown simulation flag holds send until independently verified',async()=>{
  const {ctx,result}=run({overrides:{getAuthenticatedTask:async()=>task({simulated:null})}});
  assert.equal((await result).state,'prebid_evidence_incomplete');
  assert.equal(ctx.calls.sends,0);
});
test('invalid dollar amount blocks send',async()=>{
  const {ctx,result}=run({overrides:{createPublicOnlyProposal:async()=>proposal({amount_cents:150001})}});
  assert.equal((await result).state,'prebid_evidence_incomplete');
  assert.equal(ctx.calls.sends,0);
});
test('incomplete plan blocks send',async()=>{
  const {ctx,result}=run({overrides:{createPublicOnlyProposal:async()=>proposal({approach:'hello'})}});
  assert.equal((await result).state,'prebid_evidence_incomplete');
  assert.equal(ctx.calls.sends,0);
});
test('post transport timeout is uncertain, never retried',async()=>{
  const {ctx,result}=run({overrides:{reserveAndSendOnce:async()=>{ctx.calls.sends++;throw Error('timeout')}}});
  assert.equal((await result).state,'uncertain_send_do_not_retry');
  assert.equal(ctx.calls.sends,1);
});
test('duplicate response does not claim posted',async()=>{
  const {ctx,result}=run({overrides:{
    reserveAndSendOnce:async()=>({outcome:'duplicate'})}});
  const r=await result;assert.equal(r.state,'reservation_or_marketplace_rejected');
  assert.equal(r.confirmed,false);
});
test('HTTP-like transport outcome without receipt is not confirmed',async()=>{
  const {result}=run({overrides:{
    reserveAndSendOnce:async()=>({outcome:'posted',http_status:200}),
    readAuthenticatedBidReceipt:async()=>null}});
  const r=await result;assert.equal(r.confirmed,false);
  assert.equal(r.state,'receipt_mismatch_do_not_retry');
});
test('receipt lookup failure stops without a second POST',async()=>{
  const {ctx,result}=run({overrides:{
    readAuthenticatedBidReceipt:async()=>{throw Error('temporary')}}});
  assert.equal((await result).state,'await_authenticated_receipt_do_not_retry');
  assert.equal(ctx.calls.sends,1);
});
test('wrong agent receipt never confirmed',async()=>{
  const {result}=run({overrides:{readAuthenticatedBidReceipt:async()=>receipt({agent_id:1727})}});
  assert.equal((await result).state,'receipt_mismatch_do_not_retry');
});
test('wrong task receipt never confirmed',async()=>{
  const {result}=run({overrides:{readAuthenticatedBidReceipt:async()=>receipt({problem_id:'777'})}});
  assert.equal((await result).state,'receipt_mismatch_do_not_retry');
});
test('wrong price receipt never confirmed',async()=>{
  const {result}=run({overrides:{readAuthenticatedBidReceipt:async()=>receipt({amount_cents:5000})}});
  assert.equal((await result).state,'receipt_mismatch_do_not_retry');
});
test('missing bid ID never confirmed',async()=>{
  const {result}=run({overrides:{readAuthenticatedBidReceipt:async()=>receipt({bid_id:null})}});
  assert.equal((await result).state,'receipt_mismatch_do_not_retry');
});
test('invalid receipt status never confirmed',async()=>{
  const {result}=run({overrides:{readAuthenticatedBidReceipt:async()=>receipt({status:'unknown'})}});
  assert.equal((await result).state,'receipt_mismatch_do_not_retry');
});
test('returned summary never includes customer-specific proposals',async()=>{
  const {result}=run({overrides:{
    getAuthenticatedTask:async()=>task({title:'CUSTOMER CONFIDENTIAL TITLE',private_file:'DO NOT COPY'}),
    createPublicOnlyProposal:async()=>proposal({buyer_message:'CLIENT CONFIDENTIAL MESSAGE'})}});
  const r=await result;
  assert.ok(!JSON.stringify(r).includes('CUSTOMER CONFIDENTIAL'));
  assert.ok(!JSON.stringify(r).includes('CLIENT CONFIDENTIAL'));
});


test('proposal helper never receives raw task details or customer attachments',async()=>{
  let helperInput=null;
  const {result}=run({overrides:{
    getAuthenticatedTask:async()=>task({title:'CUSTOMER-PRIVATE-TITLE',private_file:'CUSTOMER-BINARY-FILE',
      description:'FULL CLIENT DOCUMENT TEXT', attachments:['CUSTOMER-ID-42']}),
    createPublicOnlyProposal:async x=>{helperInput=x;return proposal()}
  }});
  assert.equal((await result).confirmed,true);
  const payload=JSON.stringify(helperInput);
  assert.ok(!payload.includes('CUSTOMER-PRIVATE-TITLE'));
  assert.ok(!payload.includes('CUSTOMER-BINARY-FILE'));
  assert.ok(!payload.includes('FULL CLIENT DOCUMENT TEXT'));
  assert.ok(!payload.includes('CUSTOMER-ID-42'));
  assert.equal(helperInput.access,'isolated_public_brief_only');
});
