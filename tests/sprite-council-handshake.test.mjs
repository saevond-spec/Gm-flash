import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {requestSpriteCouncilReview} from '../sprite-council-handshake.mjs';
const now=1800000000;
const intent=()=>({agent_id:1878,problem_id:'9951',amount_cents:750,
  verified_budget_cents:1000,verified_floor_cents:500,currency:'USD',incremental_cost_cents:0,
  proposal_sha256:'a'.repeat(64),scope_sha256:'b'.repeat(64),nonce:'c'.repeat(32),created_at:now});
const fakeSign=(who,c)=>createHash('sha256').update('FICTIONAL-'+who+'|'+c).digest('hex');
const approve=(who,i)=>({reviewer:who,decision:'approve',canonical_intent:canonicalBidIntent(i),
  problem_id:i.problem_id,amount_cents:i.amount_cents,nonce:i.nonce,
  approved_at:now,expires_at:now+350,signature:fakeSign(who,canonicalBidIntent(i))});
const args=()=>{
 const i=intent();
 return {intent:i,nowSec:now+1,
  novaService:{reviewBidIntent:async()=>approve('nova',i)},
  operatorService:{reviewBidIntent:async()=>approve('chatgpt_operator',i)},
  verifyNova:async(a,c)=>a.signature===fakeSign('nova',c),
  verifyOperator:async(a,c)=>a.signature===fakeSign('chatgpt_operator',c),
  readLedger:async()=>({available:true,blocking_unresolved_bid:false,existing_reservation:false,nonce_seen:false})};
};
test('DEPLOYED NOVA HOLD REPRO: historical 4-field preflight always stops before operator review',async()=>{
 const x=args();let operatorCalls=0;
 x.novaService.reviewBidIntent=async()=>({nova_reviewed:true,decision:'hold',
   may_proceed:false,chatgpt_approval_required:true});
 x.operatorService.reviewBidIntent=async()=>{operatorCalls++;throw Error('should not call')};
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.state,'hold');assert.equal(r.reason,'nova_governance_hold');
 assert.equal(operatorCalls,0);assert.equal(r.can_submit,false);
});
test('REPAIRED HANDSHAKE SIMULATION: independent verified approvals reach only atomic-reservation stage',async()=>{
 const r=await requestSpriteCouncilReview(args());
 assert.equal(r.state,'independent_reviews_verified');
 assert.equal(r.ready_for_atomic_reservation,true);
 assert.equal(r.can_submit,false);assert.equal(r.may_release_governance_hold,false);
});
test('Nova approval cannot be spoofed by a plain JSON decision',async()=>{
 const x=args();x.novaService.reviewBidIntent=async()=>({...approve('nova',x.intent),signature:'f'.repeat(64)});
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'nova_signature_invalid');assert.equal(r.can_submit,false);
});
test('operator approval cannot be spoofed by a plain JSON decision',async()=>{
 const x=args();x.operatorService.reviewBidIntent=async()=>({...approve('chatgpt_operator',x.intent),signature:'not_a_real_signature_aaaaaaaaaaaaaaa'});
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'operator_signature_invalid');
});
test('approval from another task is not accepted even if signed by Nova',async()=>{
 const x=args();x.novaService.reviewBidIntent=async()=>approve('nova',{...x.intent,problem_id:'9952'});
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'nova_intent_binding_invalid');
});
test('approval from another amount is not accepted',async()=>{
 const x=args();x.operatorService.reviewBidIntent=async()=>approve('chatgpt_operator',{...x.intent,amount_cents:800});
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'operator_intent_binding_invalid');
});
test('unavailable Nova never invokes operator',async()=>{
 const x=args();let called=false;
 x.novaService.reviewBidIntent=async()=>{throw Error('offline')};
 x.operatorService.reviewBidIntent=async()=>{called=true};
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'nova_unavailable');assert.equal(called,false);
});
test('operator hold after verified Nova blocks all dispatch',async()=>{
 const x=args();x.operatorService.reviewBidIntent=async()=>({decision:'hold'});
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'operator_governance_hold');assert.equal(r.can_submit,false);
});
test('existing unresolved new bid keeps hold even with both approvals',async()=>{
 const x=args();x.readLedger=async()=>({available:true,blocking_unresolved_bid:true,existing_reservation:false,nonce_seen:false});
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'ledger_blocked_or_unavailable');
});
test('original uncertain $6.50 job is never released',async()=>{
 const x=args();x.intent={...x.intent,problem_id:'3298'};
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'legacy_uncertain_bid');
});
test('stale exact intent is rejected',async()=>{
 const x=args();x.nowSec=now+900;
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'stale_bid_intent');
});
test('missing private operator service cannot be replaced with inferred chat approval',async()=>{
 const x=args();x.operatorService=null;
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'independent_approval_services_missing');
});
test('simulated unsigned approval does not qualify',async()=>{
 const x=args();x.novaService.reviewBidIntent=async()=>({...approve('nova',x.intent),signature:undefined});
 const r=await requestSpriteCouncilReview(x);
 assert.equal(r.reason,'nova_intent_binding_invalid');
});
