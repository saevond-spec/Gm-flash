import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {canonicalBidIntent,councilBidPreflight} from '../council-preflight.mjs';
import {spriteApprovalSigningMessage,verifySpriteApprovalSignature,
 createSpriteIndependentVerifiers} from '../sprite-independent-approvals.mjs';

const crypt=globalThis.crypto??webcrypto;
const now=1800000001;
const intent={agent_id:1878,problem_id:'9501',amount_cents:700,
 verified_budget_cents:1000,verified_floor_cents:500,currency:'USD',
 incremental_cost_cents:0,proposal_sha256:'a'.repeat(64),
 scope_sha256:'b'.repeat(64),nonce:'c'.repeat(32),created_at:now-1};
const canonical=canonicalBidIntent(intent);
const base=(reviewer)=>({reviewer,decision:'approve',canonical_intent:canonical,
 problem_id:intent.problem_id,amount_cents:intent.amount_cents,
 nonce:intent.nonce,approved_at:now-1,expires_at:now+300});
async function keyPair(){
 const k=await crypt.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 return {privateKey:k.privateKey,
  publicKey:new Uint8Array(await crypt.subtle.exportKey('raw',k.publicKey))};
}
async function signed(reviewer,k){
 const a=base(reviewer);
 const data=spriteApprovalSigningMessage(a,reviewer,canonical);
 assert.ok(data);
 const sig=new Uint8Array(await crypt.subtle.sign({name:'Ed25519'},k.privateKey,
  new TextEncoder().encode(data)));
 return {...a,signature:Buffer.from(sig).toString('base64')};
}
test('two distinct pinned signer keys validate only their own exact intent',async()=>{
 const n=await keyPair(),c=await keyPair();
 const verifiers=createSpriteIndependentVerifiers({
  novaPublicKey:n.publicKey,operatorPublicKey:c.publicKey});
 assert.ok(verifiers);
 assert.deepEqual(Object.keys(verifiers).sort(),['verifyControl','verifyNova']);
 const nova=await signed('nova',n),control=await signed('chatgpt_operator',c);
 assert.equal(await verifiers.verifyNova(nova,canonical),true);
 assert.equal(await verifiers.verifyControl(control,canonical),true);
 assert.equal(await verifiers.verifyNova(control,canonical),false);
 assert.equal(await verifiers.verifyControl(nova,canonical),false);
 const preflight=await councilBidPreflight({
  intent,nova,control,...verifiers,nowSec:now,
  readLedger:async()=>({available:true,blocking_unresolved_bid:false,
   existing_reservation:false,nonce_seen:false})
 });
 assert.equal(preflight.state,'preflight_passed_not_released');
 assert.equal(preflight.can_submit,false); // D1 + final check still required
});
test('same public key for both reviewers, or missing key, fails constructor',async()=>{
 const n=await keyPair();
 assert.equal(createSpriteIndependentVerifiers({
  novaPublicKey:n.publicKey,operatorPublicKey:new Uint8Array(n.publicKey)}),null);
 assert.equal(createSpriteIndependentVerifiers({
  novaPublicKey:n.publicKey,operatorPublicKey:undefined}),null);
 assert.equal(createSpriteIndependentVerifiers({
  novaPublicKey:new Uint8Array(32),operatorPublicKey:n.publicKey}),null);
});
test('changes to price, nonce, reviewer, signature or approval window fail cryptographic validation',async()=>{
 const n=await keyPair();
 const a=await signed('nova',n);
 const bad=[
  {...a,amount_cents:800},
  {...a,nonce:'d'.repeat(32)},
  {...a,reviewer:'chatgpt_operator'},
  {...a,signature:'A'.repeat(86)+'=='},
  {...a,approved_at:now-10},
  {...a,expires_at:now+301},
  {...a,decision:'hold'},
  {...a,canonical_intent:canonical+'tampered'}
 ];
 for(const altered of bad)
  assert.equal(await verifySpriteApprovalSignature({
   approval:altered,reviewer:'nova',canonical,publicKeyBytes:n.publicKey}),false);
});
test('arbitrary approval cannot claim a signed decision for another task',async()=>{
 const n=await keyPair(),c=await keyPair();
 const nova=await signed('nova',n);
 const control={...base('chatgpt_operator'),signature:nova.signature};
 const verifiers=createSpriteIndependentVerifiers({
  novaPublicKey:n.publicKey,operatorPublicKey:c.publicKey});
 const r=await councilBidPreflight({intent,nova,control,...verifiers,nowSec:now,
  readLedger:async()=>({available:true,blocking_unresolved_bid:false,
   existing_reservation:false,nonce_seen:false})});
 assert.equal(r.can_submit,false);
 assert.equal(r.reason,'control_signature_unverified');
});
test('approval format refuses unrelated domains and arbitrary reviewers',()=>{
 const a=base('nova');
 assert.equal(spriteApprovalSigningMessage(a,'star',canonical),null);
 assert.equal(spriteApprovalSigningMessage(a,'nova','other-v1|x'),null);
 assert.equal(spriteApprovalSigningMessage({...a,expires_at:now+9999},'nova',canonical),null);
});
