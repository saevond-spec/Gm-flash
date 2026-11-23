import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {exactCouncilApprovalMessage} from '../sprite-signed-council.mjs';
import {reviewSpriteBidWithPinnedSigners} from '../sprite-trusted-release.mjs';
const t=1800000000;
const b64=x=>Buffer.from(x).toString('base64url');
const makeIntent=()=>({agent_id:1878,problem_id:'9951',amount_cents:750,verified_budget_cents:1000,
 verified_floor_cents:500,currency:'USD',incremental_cost_cents:0,proposal_sha256:'a'.repeat(64),
 scope_sha256:'b'.repeat(64),nonce:'c'.repeat(32),created_at:t});
async function signer(role,i){
 const keys=await webcrypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const pub=b64(await webcrypto.subtle.exportKey('raw',keys.publicKey));
 const expires=t+300, canonical=canonicalBidIntent(i);
 const bytes=new TextEncoder().encode(exactCouncilApprovalMessage(role,i,t,expires));
 const signature=b64(await webcrypto.subtle.sign('Ed25519',keys.privateKey,bytes));
 return {pub,reply:{reviewer:role,decision:'approve',canonical_intent:canonical,
  problem_id:i.problem_id,amount_cents:i.amount_cents,nonce:i.nonce,
  approved_at:t,expires_at:expires,signature}};
}
async function fixture(){
 const i=makeIntent(),n=await signer('nova',i),o=await signer('chatgpt_operator',i);
 return {intent:i,novaService:{reviewBidIntent:async()=>n.reply},
 operatorService:{reviewBidIntent:async()=>o.reply},
 novaPublicKeyB64:n.pub,operatorPublicKeyB64:o.pub,
 readLedger:async()=>({available:true,blocking_unresolved_bid:false,existing_reservation:false,nonce_seen:false}),
 nowSec:t+1,cryptoApi:webcrypto};
}
test('CRYPTOSIGNED PRIVATE HANDSHAKE: two independent real Ed25519 signatures pass preflight only',async()=>{
 const r=await reviewSpriteBidWithPinnedSigners(await fixture());
 assert.equal(r.state,'signed_preflight_passed_not_released');assert.equal(r.can_submit,false);
 assert.equal(r.requires_atomic_reservation,true);
});
test('CRYPTOSIGNED PRIVATE HANDSHAKE: same public key invalid even with independently signed messages',async()=>{
 const x=await fixture();x.operatorPublicKeyB64=x.novaPublicKeyB64;
 const r=await reviewSpriteBidWithPinnedSigners(x);
 assert.equal(r.reason,'distinct_trusted_public_keys_missing');
});
test('CRYPTOSIGNED PRIVATE HANDSHAKE: deployed Nova hold stops operator service from authorizing',async()=>{
 const x=await fixture();let invoked=false;
 x.novaService.reviewBidIntent=async()=>({decision:'hold',may_proceed:false});
 x.operatorService.reviewBidIntent=async()=>{invoked=true};
 const r=await reviewSpriteBidWithPinnedSigners(x);
 assert.equal(r.reason,'nova_not_approved');assert.equal(invoked,false);
});
test('CRYPTOSIGNED PRIVATE HANDSHAKE: valid signed reviewers cannot bypass outstanding reservation',async()=>{
 const x=await fixture();
 x.readLedger=async()=>({available:true,blocking_unresolved_bid:true,existing_reservation:false,nonce_seen:false});
 const r=await reviewSpriteBidWithPinnedSigners(x);
 assert.equal(r.reason,'ledger_blocked_or_unavailable');
});
test('CRYPTOSIGNED PRIVATE HANDSHAKE: pinned key from wrong signer cannot pass',async()=>{
 const x=await fixture(),newKey=await signer('nova',x.intent);
 x.novaPublicKeyB64=newKey.pub;
 const r=await reviewSpriteBidWithPinnedSigners(x);
 assert.equal(r.reason,'nova_signature_or_binding_invalid');
});
test('CRYPTOSIGNED PRIVATE HANDSHAKE: exact $6.50 historical task cannot be reviewed',async()=>{
 const x=await fixture();x.intent={...x.intent,problem_id:'3298'};
 const r=await reviewSpriteBidWithPinnedSigners(x);
 assert.equal(r.reason,'invalid_or_legacy_bid');
});
