import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {exactCouncilApprovalMessage} from '../sprite-signed-council.mjs';
import {reviewSpriteBidWithPinnedSigners,reserveSignedSpriteBid} from '../sprite-trusted-release.mjs';
import {sendReservedBidOnce} from '../council-release.mjs';
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
async function fixture(i=makeIntent()){
 const m=await signer('mother',i),n=await signer('nova',i),o=await signer('chatgpt_operator',i);
 return {intent:i,motherService:{reviewBidIntent:async()=>m.reply},novaService:{reviewBidIntent:async()=>n.reply},
 operatorService:{reviewBidIntent:async()=>o.reply},
 motherPublicKeyB64:m.pub,novaPublicKeyB64:n.pub,operatorPublicKeyB64:o.pub,
 readLedger:async()=>({available:true,blocking_unresolved_bid:false,existing_reservation:false,nonce_seen:false}),
 nowSec:t+1,cryptoApi:webcrypto};
}
test('CRYPTOSIGNED PRIVATE HANDSHAKE: three independent real Ed25519 signatures pass preflight only',async()=>{
 const r=await reviewSpriteBidWithPinnedSigners(await fixture());
 assert.equal(r.state,'signed_preflight_passed_not_released');assert.equal(r.can_submit,false);
 assert.equal(r.requires_atomic_reservation,true);
});
test('CRYPTOSIGNED PRIVATE HANDSHAKE: same public key invalid even with independently signed messages',async()=>{
 const x=await fixture();x.operatorPublicKeyB64=x.novaPublicKeyB64;
 const r=await reviewSpriteBidWithPinnedSigners(x);
 assert.equal(r.reason,'three_distinct_trusted_public_keys_missing');
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


class FakeD1 {
 constructor(){
  this.db=new DatabaseSync(':memory:');
  this.db.exec("CREATE TABLE bid_reservations(agent_id INTEGER NOT NULL,problem_id TEXT NOT NULL,amount_cents INTEGER NOT NULL,state TEXT NOT NULL,PRIMARY KEY(agent_id,problem_id));");
  this.db.exec(readFileSync(new URL('../migrations/20261122_sprite_council_nonces.sql',import.meta.url),'utf8'));
  this.db.prepare("INSERT INTO bid_reservations VALUES(1878,'3298',650,'uncertain')").run();
 }
 prepare(sql){
  return {bind:(...args)=>({
    sql,args,first:async()=>this.db.prepare(sql).get(...args)??null
  })};
 }
 async batch(stmts){
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const result=stmts.map(s=>({results:this.db.prepare(s.sql).all(...s.args)}));
   this.db.exec('COMMIT');
   return result;
  }catch(e){this.db.exec('ROLLBACK');throw e}
 }
 readLedger=async(id,nonce)=>({
  available:true,
  blocking_unresolved_bid:!!this.db.prepare(
   "SELECT 1 FROM bid_reservations WHERE agent_id=1878 AND problem_id<>'3298' AND state IN ('reserved','uncertain') LIMIT 1").get(),
  existing_reservation:!!this.db.prepare(
   "SELECT 1 FROM bid_reservations WHERE agent_id=1878 AND problem_id=?").get(id),
  nonce_seen:!!this.db.prepare(
   "SELECT 1 FROM sprite_council_nonce_consumption WHERE nonce=?").get(nonce)
 });
 count(sql){return this.db.prepare(sql).get().n}
 close(){this.db.close()}
}
const proposal='Fictional CSV cleaning job: validate row totals and independently reproduce every numeric acceptance check.';
const proposalHash=createHash('sha256').update(proposal).digest('hex');
test('END TO END: 3 Ed25519 approvals -> live SQLite nonce/reservation -> exactly one FAKE submission',async()=>{
 const db=new FakeD1();let sends=0;
 try{
  const x=await fixture({...makeIntent(),proposal_sha256:proposalHash});
  const ctx={...x,db,readLedger:db.readLedger,independentFinalCheck:async()=>true};
  const grant=await reserveSignedSpriteBid(ctx);
  assert.equal(grant.state,'reserved_for_one_submission',JSON.stringify(grant));
  assert.equal(grant.can_submit,true);assert.equal(grant.reserved,true);
  assert.equal(db.count("SELECT COUNT(*) n FROM sprite_council_nonce_consumption"),1);
  const sent=await sendReservedBidOnce({
   db,grant,proposalText:proposal,nowSec:t+1,trustedNowSec:async()=>t+2,
   send:async body=>{sends++;assert.equal(body.problem_id,'9951');
    assert.equal(body.amount_cents,750);assert.equal(body.message,proposal);
    return {status:201}}
  });
  assert.equal(sent.attempted,true);assert.equal(sent.confirmed,false);
  const duplicate=await sendReservedBidOnce({
   db,grant,proposalText:proposal,nowSec:t+1,trustedNowSec:async()=>t+2,
   send:async()=>{sends++;return {status:201}}
  });
  assert.equal(duplicate.attempted,false);assert.equal(sends,1);
  const second=await reserveSignedSpriteBid(ctx);
  assert.equal(second.can_submit,false);
  assert.equal(db.count("SELECT COUNT(*) n FROM bid_reservations WHERE problem_id<>'3298'"),1);
  assert.equal(db.db.prepare("SELECT state FROM bid_reservations WHERE problem_id='3298'").get().state,'uncertain');
 }finally{db.close()}
});
test('END TO END: real Ed25519 approvals cannot override stale/failed marketplace eligibility',async()=>{
 const db=new FakeD1();
 try{
  const x=await fixture({...makeIntent(),proposal_sha256:proposalHash});
  const grant=await reserveSignedSpriteBid({...x,db,readLedger:db.readLedger,independentFinalCheck:async()=>false});
  assert.equal(grant.can_submit,false);
  assert.equal(grant.reason,'fresh_market_validation_failed');
  assert.equal(db.count("SELECT COUNT(*) n FROM sprite_council_nonce_consumption"),0);
 }finally{db.close()}
});
test('END TO END: Nova HOLD and second signer fail to produce a reserved bid',async()=>{
 const db=new FakeD1();
 try{
  const x=await fixture({...makeIntent(),proposal_sha256:proposalHash});
  x.novaService.reviewBidIntent=async()=>({decision:'hold',may_proceed:false});
  const grant=await reserveSignedSpriteBid({...x,db,readLedger:db.readLedger,independentFinalCheck:async()=>true});
  assert.equal(grant.can_submit,false);
  assert.equal(grant.reason,'nova_not_approved');
  assert.equal(db.count("SELECT COUNT(*) n FROM sprite_council_nonce_consumption"),0);
 }finally{db.close()}
});

test('MOTHER SERVICE ABSENT: even perfect Nova and operator signatures cannot reserve a bid',async()=>{
 const x=await fixture();x.motherService=null;
 const r=await reviewSpriteBidWithPinnedSigners(x);
 assert.equal(r.reason,'private_review_services_unavailable');assert.equal(r.can_submit,false);
});
test('MOTHER HOLD: Nova and operator services are never invoked after Mother refusal',async()=>{
 const x=await fixture();let novaCalls=0,operatorCalls=0;
 x.motherService.reviewBidIntent=async()=>({decision:'hold'});
 x.novaService.reviewBidIntent=async()=>{novaCalls++;return {decision:'approve'}};
 x.operatorService.reviewBidIntent=async()=>{operatorCalls++;return {decision:'approve'}};
 const r=await reviewSpriteBidWithPinnedSigners(x);
 assert.equal(r.reason,'mother_not_approved');assert.equal(novaCalls,0);assert.equal(operatorCalls,0);
});
