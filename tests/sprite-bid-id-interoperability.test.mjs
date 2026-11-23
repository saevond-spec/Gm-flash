import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySpriteReceiptEvidence,reconcileSpriteUncertainBid} from '../sprite-authoritative-reconciliation.mjs';
import {routeSprite3298Evidence} from '../sprite-3298-evidence-router.mjs';
import {DatabaseSync} from 'node:sqlite';

const base=({bid_id=93521,agent_id=1878,problem_id='3298',amount_cents=650,status='submitted',...rest}={})=>({
  source_type:'authenticated_bid_record',authenticated:true,
  bid:{bid_id,agent_id,problem_id,amount_cents,status,...rest}
});
const classify=records=>classifySpriteReceiptEvidence({
  problemId:'3298',amountCents:650,records
});
test('CLAW ID INTEROP: positive safe numeric bid ID is an exact candidate, never automatic confirmation',()=>{
 const r=classify([base()]);
 assert.equal(r.state,'exact_receipt_candidate');
 assert.equal(r.bid_id,'93521');assert.equal(r.confirmed,false);assert.equal(r.may_resubmit,false);
});
test('CLAW ID INTEROP: matching integer string agent #1878 accepted',()=>{
 const r=classify([base({agent_id:'1878'})]);
 assert.equal(r.state,'exact_receipt_candidate');assert.equal(r.bid_id,'93521');
});
test('CLAW ID INTEROP: numerical and text encodings of same official ID normalize to one candidate',()=>{
 const r=classify([base(),base({bid_id:'93521'})]);
 assert.equal(r.state,'exact_receipt_candidate');assert.equal(r.bid_id,'93521');
});
test('CLAW ID INTEROP: explicit proposal_id field accepted in place of bid_id but remains unconfirmed',()=>{
 const r=classify([base({bid_id:undefined,proposal_id:93521})]);
 assert.equal(r.state,'exact_receipt_candidate');assert.equal(r.bid_id,'93521');
});
test('CLAW ID INTEROP: safe numeric task ID supported through exact string comparison',()=>{
 const r=classify([base({problem_id:3298})]);
 assert.equal(r.state,'exact_receipt_candidate');
});
for(const value of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER,1e15,'0','001','-1','1.5',{},[],true,null,undefined]){
 test('CLAW ID INTEROP: invalid numeric ID '+String(value)+' cannot be receipt',()=>{
  const r=classify([base({bid_id:value})]);
  assert.equal(r.state,'unresolved');assert.equal(r.may_resubmit,false);
 });
}
for(const value of [1879,'01878','1878 ','not-1878',null,{},1878.01]){
 test('CLAW ID INTEROP: non-exact agent '+String(value)+' cannot be confirmed',()=>{
  const r=classify([base({agent_id:value})]);
  assert.equal(r.state,'unresolved');assert.equal(r.may_resubmit,false);
 });
}
test('CLAW ID INTEROP: false 650-cent price encoded as a string remains held',()=>{
 const r=classify([base({amount_cents:'650'})]);
 assert.equal(r.state,'unresolved');assert.equal(r.may_resubmit,false);
});
test('CLAW ID INTEROP: generic id without explicit bid_id or proposal_id remains held',()=>{
 const r=classify([base({bid_id:undefined,id:93521})]);
 assert.equal(r.state,'unresolved');
});
test('CLAW ID INTEROP: authorized outcome with numeric bid ID is only a candidate',()=>{
 const r=routeSprite3298Evidence({observations:[{
  route:'bid_outcomes',path:'/api/v1/bids/outcomes',method:'GET',http_status:200,
  authenticated_private_collector:true,agent_id:1878,
  body:{data:{outcomes:[{bid_id:93521,agent_id:'1878',problem_id:3298,amount_cents:650,status:'submitted'}]}}
 }]});
 assert.equal(r.state,'exact_candidate_only');
 assert.equal(r.candidate_bid_id,'93521');
 assert.equal(r.confirmed,false);assert.equal(r.may_resubmit,false);
});
test('CLAW ID INTEROP: normalized numeric ID still needs independently verified official proof',async()=>{
 const raw=new DatabaseSync(':memory:');
 try{
 raw.exec("CREATE TABLE bid_reservations(agent_id INTEGER,problem_id TEXT,amount_cents INTEGER,state TEXT,PRIMARY KEY(agent_id,problem_id));CREATE TABLE sprite_bid_receipts(problem_id TEXT PRIMARY KEY,bid_id TEXT,amount_cents INTEGER,source TEXT,observed_at TEXT)");
 raw.exec("INSERT INTO bid_reservations VALUES(1878,'3298',650,'uncertain')");
 let verifierCalled=0;
 const db={prepare(sql){return {bind:(...args)=>({first:async()=>raw.prepare(sql).get(...args)??null})}},async batch(){throw Error('unexpected promotion')}};
 const r=await reconcileSpriteUncertainBid({db,problemId:'3298',amountCents:650,observedAt:'2026-11-23T03:10:00.000Z',
  collectAuthoritativeRecords:async()=>({source:'authenticated_private_marketplace_collector',identity_verified:true,records:[base()]}),
  verifyExactReceipt:async p=>{verifierCalled++;assert.equal(p.bid_id,'93521');return false;}});
 assert.equal(r.reason,'receipt_authenticity_not_verified');assert.equal(r.confirmed,false);
 assert.equal(verifierCalled,1);
 assert.equal(raw.prepare("SELECT state FROM bid_reservations WHERE problem_id='3298'").get().state,'uncertain');
 }finally{raw.close()}
});
