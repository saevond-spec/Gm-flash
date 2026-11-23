import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {exactCouncilApprovalMessage} from '../sprite-signed-council.mjs';
import {verifyStageTripartite} from '../sprite-tripartite-stage-verifier.mjs';
const T=1800000000;
const b64=buf=>Buffer.from(buf).toString('base64url');
const intent=()=>({agent_id:1878,problem_id:'999999991',amount_cents:750,
 verified_budget_cents:1000,verified_floor_cents:500,currency:'USD',incremental_cost_cents:0,
 proposal_sha256:'a'.repeat(64),scope_sha256:'b'.repeat(64),
 nonce:'c'.repeat(32),created_at:T});
const reviewer=async(role,i)=>{
 const k=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const msg=exactCouncilApprovalMessage(role,i,T,T+350);
 const signature=b64(await webcrypto.subtle.sign({name:'Ed25519'},k.privateKey,new TextEncoder().encode(msg)));
 return {pub:b64(await webcrypto.subtle.exportKey('raw',k.publicKey)),
  approval:{reviewer:role,decision:'approve',stage_only:true,
    problem_id:i.problem_id,amount_cents:i.amount_cents,nonce:i.nonce,
    canonical_intent:canonicalBidIntent(i),approved_at:T,expires_at:T+350,signature}};
};
const fixture=async()=>{
 const i=intent(),m=await reviewer('mother',i),n=await reviewer('nova',i),
  o=await reviewer('chatgpt_operator',i);
 return {intent:i,mother:m.approval,nova:n.approval,operator:o.approval,
 motherPublicKeyB64:m.pub,novaPublicKeyB64:n.pub,operatorPublicKeyB64:o.pub,
 nowSec:T+30,cryptoApi:webcrypto};
};
test('TRIPARTITE: three authentic independent Ed25519 approvals validate fictional stage only',async()=>{
 const r=await verifyStageTripartite(await fixture());
 assert.equal(r.state,'fictional_three_signatures_verified');assert.equal(r.can_submit,false);
 assert.equal(r.requires_production_reviewer_implementation,true);
});
test('TRIPARTITE: no Mother approval means HOLD even if Nova/operator signed',async()=>{
 const x=await fixture();x.mother=null;
 assert.equal((await verifyStageTripartite(x)).reason,'mother_exact_approval_invalid');
});
test('TRIPARTITE: no Nova approval means HOLD even with Mother/operator',async()=>{
 const x=await fixture();x.nova=null;
 assert.equal((await verifyStageTripartite(x)).reason,'nova_exact_approval_invalid');
});
test('TRIPARTITE: no separately authorized operator means HOLD',async()=>{
 const x=await fixture();x.operator=null;
 assert.equal((await verifyStageTripartite(x)).reason,'chatgpt_operator_exact_approval_invalid');
});
test('TRIPARTITE: caller cannot duplicate Mother key to simulate operator',async()=>{
 const x=await fixture();x.operatorPublicKeyB64=x.motherPublicKeyB64;
 assert.equal((await verifyStageTripartite(x)).reason,'three_distinct_trusted_keys_required');
});
test('TRIPARTITE: untrusted stage approval without stage_only flag cannot validate',async()=>{
 const x=await fixture();x.mother.stage_only=false;
 assert.equal((await verifyStageTripartite(x)).reason,'mother_exact_approval_invalid');
});
test('TRIPARTITE: changed task/quote/proposal/nonce cannot reuse approvals',async()=>{
 for(const [name,mutation]of [
 ['task',x=>x.intent.problem_id='999999992'],
 ['quote',x=>x.intent.amount_cents=850],
 ['proposal',x=>x.intent.proposal_sha256='f'.repeat(64)],
 ['nonce',x=>x.intent.nonce='e'.repeat(32)]
 ]){
 const x=await fixture();mutation(x);
 const r=await verifyStageTripartite(x);
 assert.equal(r.state,'hold',name);assert.equal(r.can_submit,false,name);
 }
});
test('TRIPARTITE: expired approval must HOLD all further stages',async()=>{
 const x=await fixture();x.nowSec=T+350;
 const r=await verifyStageTripartite(x);
 assert.equal(r.state,'hold');assert.equal(r.can_submit,false);
});
test('TRIPARTITE: copied Nova signature cannot satisfy Mother',async()=>{
 const x=await fixture();x.mother.signature=x.nova.signature;
 const r=await verifyStageTripartite(x);
 assert.equal(r.reason,'mother_signature_unverified');
});
test('TRIPARTITE: attempt to sign actual #3298 cannot ever pass stage',async()=>{
 const x=await fixture();x.intent.problem_id='3298';
 const r=await verifyStageTripartite(x);
 assert.equal(r.reason,'not_an_exact_fictional_stage_intent');
});
test('TRIPARTITE: 128 parallel validations cannot emit a single marketplace send grant',async()=>{
 const x=await fixture();
 const runs=await Promise.all(Array.from({length:128},()=>verifyStageTripartite(x)));
 assert.ok(runs.every(r=>r.state==='fictional_three_signatures_verified'&&r.can_submit===false));
});
