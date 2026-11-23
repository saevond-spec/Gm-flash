import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalBidIntent,councilBidPreflight} from '../council-preflight.mjs';
const time=1800000000;
const intent={agent_id:1878,problem_id:'9951',amount_cents:750,verified_budget_cents:1000,verified_floor_cents:500,currency:'USD',incremental_cost_cents:0,proposal_sha256:'a'.repeat(64),scope_sha256:'b'.repeat(64),nonce:'c'.repeat(32),created_at:time};
const cert=(reviewer)=>({reviewer,decision:'approve',canonical_intent:canonicalBidIntent(intent),problem_id:'9951',amount_cents:750,nonce:intent.nonce,approved_at:time,expires_at:time+800});
const ok={intent,nova:cert('nova'),control:cert('chatgpt_operator'),verifyNova:async()=>true,verifyControl:async()=>true,readLedger:async()=>({available:true,blocking_unresolved_bid:false,existing_reservation:false,nonce_seen:false}),nowSec:time+1};
test('both authenticated approvals only pass *preflight*, cannot submit',async()=>{
 const r=await councilBidPreflight(ok);assert.equal(r.state,'preflight_passed_not_released');assert.equal(r.can_submit,false);assert.equal(r.may_release_governance_hold,false);
});
for(const [name,replace,reason] of [
 ['Nova denies',{nova:{...ok.nova,decision:'hold'}},'nova_approval_missing_or_mismatched'],
 ['control absent',{control:null},'control_approval_missing_or_mismatched'],
 ['amount mismatch',{nova:{...ok.nova,amount_cents:500}},'nova_approval_missing_or_mismatched'],
 ['floor increased above quote',{intent:{...intent,verified_floor_cents:800}},'invalid_or_expired_intent'],
 ['different proposal',{intent:{...intent,proposal_sha256:'e'.repeat(64)}},'nova_approval_missing_or_mismatched'],
 ['different nonce',{control:{...ok.control,nonce:'f'.repeat(32)}},'control_approval_missing_or_mismatched'],
 ['missing signature verifier',{verifyNova:null},'trusted_services_missing'],
 ['invalid signature',{verifyNova:async()=>false},'nova_signature_unverified'],
 ['unknown outstanding reservation',{readLedger:async()=>({available:true,blocking_unresolved_bid:true,existing_reservation:false,nonce_seen:false})},'ledger_blocked_or_unavailable'],
 ['replayed nonce',{readLedger:async()=>({available:true,blocking_unresolved_bid:false,existing_reservation:false,nonce_seen:true})},'ledger_blocked_or_unavailable'],
 ['ledger error',{readLedger:async()=>{throw Error('unavailable')}},'trusted_service_error'],
 ['expired',{nowSec:time+901},'invalid_or_expired_intent'],
]) test('fail closed: '+name,async()=>{const r=await councilBidPreflight({...ok,...replace});assert.equal(r.state,'hold');assert.equal(r.can_submit,false);assert.equal(r.reason,reason);});

test('original #3298 is permanently held irrespective of otherwise valid approvals',async()=>{
 const original={...intent,problem_id:'3298'};
 const r=await councilBidPreflight({...ok,intent:original});
 assert.equal(r.state,'hold');assert.equal(r.reason,'legacy_bid_3298_held');
});

test('ledger callback receives exact task AND nonce from signed intent',async()=>{
 let observed=[];
 const r=await councilBidPreflight({...ok,readLedger:async(problem,nonce)=>{
  observed=[problem,nonce];
  return {available:true,blocking_unresolved_bid:false,existing_reservation:false,nonce_seen:false};
 }});
 assert.deepEqual(observed,[intent.problem_id,intent.nonce]);
 assert.equal(r.state,'preflight_passed_not_released');
});
