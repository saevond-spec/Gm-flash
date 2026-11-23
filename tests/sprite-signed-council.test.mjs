import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {exactCouncilApprovalMessage,verifyIndependentSpriteCouncil} from '../sprite-signed-council.mjs';

const now=1800000000;
const encode=bytes=>Buffer.from(bytes).toString('base64url');
const intent=()=>({agent_id:1878,problem_id:'9951',amount_cents:750,
 verified_budget_cents:1000,verified_floor_cents:500,currency:'USD',incremental_cost_cents:0,
 proposal_sha256:'a'.repeat(64),scope_sha256:'b'.repeat(64),
 nonce:'c'.repeat(32),created_at:now});
async function signer(){
 const pair=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const publicKeyB64=encode(await webcrypto.subtle.exportKey('raw',pair.publicKey));
 return {pair,publicKeyB64};
}
async function approval(role,i,s){
 const approvedAt=now,expiresAt=now+300;
 const message=exactCouncilApprovalMessage(role,i,approvedAt,expiresAt);
 const signature=encode(await webcrypto.subtle.sign({name:'Ed25519'},s.pair.privateKey,new TextEncoder().encode(message)));
 return {reviewer:role,decision:'approve',canonical_intent:canonicalBidIntent(i),
  problem_id:i.problem_id,amount_cents:i.amount_cents,nonce:i.nonce,
  approved_at:approvedAt,expires_at:expiresAt,signature};
}
async function fixture(){
 const i=intent(),m=await signer(),n=await signer(),o=await signer();
 return {intent:i,nowSec:now+2,mother:await approval('mother',i,m),nova:await approval('nova',i,n),
  control:await approval('chatgpt_operator',i,o),
  motherPublicKeyB64:m.publicKeyB64,novaPublicKeyB64:n.publicKeyB64,operatorPublicKeyB64:o.publicKeyB64,
  cryptoApi:webcrypto,m,n,o};
}
test('REAL ED25519 CRYPTO: three distinct generated private keys verify exact fictional bid',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil(f);
 assert.equal(r.state,'verified_tripartite_signatures');
 assert.equal(r.can_submit,false);
 assert.equal(r.requires_atomic_reservation,true);
});
test('REAL ED25519 CRYPTO: same public key for both roles is always rejected',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,operatorPublicKeyB64:f.novaPublicKeyB64});
 assert.equal(r.reason,'three_distinct_trusted_public_keys_missing');
});
test('REAL ED25519 CRYPTO: Nova signature must not verify under operator key',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,novaPublicKeyB64:f.operatorPublicKeyB64,
  operatorPublicKeyB64:f.novaPublicKeyB64});
 assert.equal(r.reason,'mother_signature_or_binding_invalid');
});
test('REAL ED25519 CRYPTO: modified exact task invalidates both signed approvals',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,intent:{...f.intent,problem_id:'9952'}});
 assert.equal(r.reason,'nova_signature_or_binding_invalid');
});
test('REAL ED25519 CRYPTO: modified quote invalidates approvals',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,intent:{...f.intent,amount_cents:850}});
 assert.equal(r.reason,'nova_signature_or_binding_invalid');
});
test('REAL ED25519 CRYPTO: modified proposal hash invalidates exact intent',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,intent:{...f.intent,proposal_sha256:'d'.repeat(64)}});
 assert.equal(r.reason,'nova_signature_or_binding_invalid');
});
test('REAL ED25519 CRYPTO: forged base64 signature is not accepted',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,nova:{...f.nova,signature:encode(new Uint8Array(64))}});
 assert.equal(r.reason,'nova_signature_or_binding_invalid');
});
test('REAL ED25519 CRYPTO: operator hold stops after valid Nova signature',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,control:{...f.control,decision:'hold'}});
 assert.equal(r.reason,'operator_signature_or_binding_invalid');
});
test('REAL ED25519 CRYPTO: approval expiry cannot be extended using unsigned JSON',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,control:{...f.control,expires_at:now+700}});
 assert.equal(r.reason,'operator_signature_or_binding_invalid');
});
test('REAL ED25519 CRYPTO: exact expiry instant is a hold',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,nowSec:now+300});
 assert.equal(r.reason,'nova_signature_or_binding_invalid');
});
test('REAL ED25519 CRYPTO: invalid public key bytes fail closed',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,novaPublicKeyB64:'invalid'});
 assert.equal(r.reason,'distinct_trusted_public_keys_missing');
});
test('REAL ED25519 CRYPTO: legacy original #3298 never enters council signature verification',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,intent:{...f.intent,problem_id:'3298'}});
 assert.equal(r.reason,'intent_invalid_or_legacy');
});
test('REAL ED25519 CRYPTO: role swapping and copied Nova signature fail',async()=>{
 const f=await fixture();
 const r=await verifyIndependentSpriteCouncil({...f,control:{
  ...f.nova,reviewer:'chatgpt_operator'}});
 assert.equal(r.reason,'operator_signature_or_binding_invalid');
});

test('REAL ED25519 CRYPTO: missing mother signature fails closed',async()=>{
 const f=await fixture();f.mother=null;
 const r=await verifyIndependentSpriteCouncil(f);
 assert.equal(r.reason,'mother_signature_or_binding_invalid');
});
