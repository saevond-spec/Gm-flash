import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {exactCouncilApprovalMessage} from '../sprite-signed-council.mjs';
import {reviewMotherStageBid} from '../sprite-mother-review-policy.mjs';
import {reviewNovaStageBid} from '../sprite-nova-review-policy.mjs';
const T=1800000000;
const intent=()=>({agent_id:1878,problem_id:'999999991',amount_cents:750,
 verified_budget_cents:1000,verified_floor_cents:500,currency:'USD',incremental_cost_cents:0,
 proposal_sha256:'a'.repeat(64),scope_sha256:'b'.repeat(64),
 nonce:'c'.repeat(32),created_at:T});
function motherPacket(){
 const i=intent();
 return {intent:i,nowSec:T+30,evidence:{
  stage_marker:'sprite-fictional-council-v1',source:'fictional_mother_evidence',
  canonical_intent:canonicalBidIntent(i),agent_id:1878,problem_id:i.problem_id,nonce:i.nonce,
  collected_at:T+20,task_status:'bidding',currency:'USD',
  budget_cents:1000,floor_cents:500,own_bid_exists:false,
  incremental_cost_cents:0,isolated_delivery:true,
  scope_sha256:i.scope_sha256,proposal_sha256:i.proposal_sha256,deadline_feasible:true,
  acceptance:[
    {id:'check-1',requirement:'Deliver fictional CSV with complete row counts',verification_method:'Recompute the fictional row total',deliverable_isolated:true},
    {id:'check-2',requirement:'Document fictional transformation reproducibility',verification_method:'Independently replay the test transform',deliverable_isolated:true}
  ]}};
}
function novaPacket(){
 const i=intent();return {intent:i,nowSec:T+30,evidence:{
 stage_marker:'sprite-fictional-council-v1',source:'fictional_nova_evidence',
 canonical_intent:canonicalBidIntent(i),agent_id:1878,problem_id:i.problem_id,nonce:i.nonce,
 observed_at:T+25,agent_standing:'eligible',owner_active:true,heartbeat_age_sec:15,
 market_bid_allowed:true,duplicate_bid_detected:false,currency:'USD',task_status:'bidding',
 simulated_task:true,verified_budget_cents:1000,verified_floor_cents:500,quote_cents:750,
 proposal_sha256:i.proposal_sha256,scope_sha256:i.scope_sha256,delivery_feasible:true,
 incremental_cost_cents:0,reservation_conflict:false,nonce_seen:false}};
}
test('STAGE RPC CONTRACT: Mother separately passes exact fictional acceptance/delivery review',()=>{
 const x=reviewMotherStageBid(motherPacket());
 assert.equal(x.state,'eligible_for_stage_signature');assert.equal(x.may_sign,true);
 assert.equal(x.can_submit,false);assert.equal(x.reviewer,'mother');
});
test('STAGE RPC CONTRACT: Nova independently passes fictional market and duplicate analysis',()=>{
 const x=reviewNovaStageBid(novaPacket());
 assert.equal(x.state,'eligible_for_stage_signature');assert.equal(x.may_sign,true);
 assert.equal(x.can_submit,false);assert.equal(x.reviewer,'nova');
});
test('STAGE RPC CONTRACT: both reviewers categorically hold the REAL historical #3298',()=>{
 for(const [fn,packet]of [[reviewMotherStageBid,motherPacket()],[reviewNovaStageBid,novaPacket()]]){
  packet.intent.problem_id='3298';
  const x=fn(packet);assert.equal(x.state,'hold');assert.equal(x.may_sign,false);
 }
});
test('STAGE RPC CONTRACT: normal real task IDs are never signed by staging reviewer',()=>{
 for(const id of ['3482','3298','9951','1234567']){
  for(const [fn,packet]of [[reviewMotherStageBid,motherPacket()],[reviewNovaStageBid,novaPacket()]]){
   packet.intent.problem_id=id;assert.equal(fn(packet).state,'hold');
  }
 }
});
test('STAGE RPC CONTRACT: escrow is optional and never ranks in Mother/Nova stage gates',()=>{
 const x=motherPacket();x.evidence.escrow_required=true;
 assert.equal(reviewMotherStageBid(x).state,'eligible_for_stage_signature');
 const y=novaPacket();y.evidence.escrow_status=null;
 assert.equal(reviewNovaStageBid(y).state,'eligible_for_stage_signature');
});
const motherMutations=[
 x=>x.evidence.source='unverified_http',x=>x.evidence.canonical_intent='fake',
 x=>x.evidence.collected_at=T-500,x=>x.evidence.budget_cents=400,
 x=>x.evidence.floor_cents=800,x=>x.evidence.own_bid_exists=true,
 x=>x.evidence.incremental_cost_cents=1,x=>x.evidence.isolated_delivery=false,
 x=>x.evidence.proposal_sha256='d'.repeat(64),
 x=>x.evidence.scope_sha256='d'.repeat(64),x=>x.evidence.deadline_feasible=false,
 x=>x.evidence.acceptance=[],x=>x.evidence.acceptance[1].id='check-1',
 x=>x.evidence.acceptance[0].deliverable_isolated=false,
 x=>x.evidence.acceptance[0].verification_method='none',
 x=>x.evidence.nonce='e'.repeat(32)
];
const novaMutations=[
 x=>x.evidence.source='unverified_http',x=>x.evidence.canonical_intent='bad',
 x=>x.evidence.observed_at=T-200,x=>x.evidence.agent_standing='blocked',
 x=>x.evidence.owner_active=false,x=>x.evidence.heartbeat_age_sec=200,
 x=>x.evidence.market_bid_allowed=false,x=>x.evidence.duplicate_bid_detected=true,
 x=>x.evidence.verified_budget_cents=500,x=>x.evidence.verified_floor_cents=800,
 x=>x.evidence.quote_cents=899,x=>x.evidence.simulated_task=false,
 x=>x.evidence.proposal_sha256='d'.repeat(64),
 x=>x.evidence.scope_sha256='d'.repeat(64),x=>x.evidence.delivery_feasible=false,
 x=>x.evidence.incremental_cost_cents=1,x=>x.evidence.reservation_conflict=true,
 x=>x.evidence.nonce_seen=true
];
for(const [name,make,fn,muts]of [
 ['mother',motherPacket,reviewMotherStageBid,motherMutations],
 ['nova',novaPacket,reviewNovaStageBid,novaMutations]
]){
 for(const [index,mut]of muts.entries()){
  test(name+' rejects altered independent fact '+index,()=>{
   const x=make();mut(x);
   const r=fn(x);assert.equal(r.state,'hold');assert.equal(r.can_submit,false);
  });
 }
 test(name+' 1024 deterministic adverse fictional mutations never sign or submit',()=>{
  let seed=name==='mother'?0x34ff56:0x9244ff;
  const rand=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
  for(let i=0;i<1024;i++){
    const x=make();muts[rand()%muts.length](x);
    const r=fn(x);assert.equal(r.state,'hold',name+' variant '+i);
    assert.equal(r.may_sign,false);assert.equal(r.can_submit,false);
  }
 });
}
test('STAGE RPC CRYPTO: Mother and Nova use disjoint Ed25519 signature domains',async()=>{
 const i=intent();const mother=exactCouncilApprovalMessage('mother',i,T+30,T+300);
 const nova=exactCouncilApprovalMessage('nova',i,T+30,T+300);
 const operator=exactCouncilApprovalMessage('chatgpt_operator',i,T+30,T+300);
 assert.ok(mother&&nova&&operator&&mother!==nova&&nova!==operator);
 const k=await webcrypto.subtle.generateKey({name:'Ed25519'},false,['sign','verify']);
 const sig=await webcrypto.subtle.sign({name:'Ed25519'},k.privateKey,new TextEncoder().encode(mother));
 assert.equal(await webcrypto.subtle.verify({name:'Ed25519'},k.publicKey,sig,new TextEncoder().encode(mother)),true);
 assert.equal(await webcrypto.subtle.verify({name:'Ed25519'},k.publicKey,sig,new TextEncoder().encode(nova)),false);
});
