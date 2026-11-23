import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {classifySpriteReceiptEvidence,reconcileSpriteUncertainBid} from '../sprite-authoritative-reconciliation.mjs';
const expected={problemId:'3298',amountCents:650};
const official=(extra={})=>({source_type:'authenticated_bid_record',authenticated:true,
 bid:{bid_id:'BID-REAL-SHAPED-100',problem_id:'3298',agent_id:1878,amount_cents:650},...extra});
class Ledger{
 constructor(){
  this.raw=new DatabaseSync(':memory:');
  this.raw.exec("CREATE TABLE bid_reservations(agent_id INTEGER NOT NULL,problem_id TEXT NOT NULL,amount_cents INTEGER NOT NULL,state TEXT NOT NULL,PRIMARY KEY(agent_id,problem_id));");
  this.raw.exec("CREATE TABLE sprite_bid_receipts(problem_id TEXT PRIMARY KEY,bid_id TEXT NOT NULL,amount_cents INTEGER NOT NULL,source TEXT NOT NULL,observed_at TEXT NOT NULL)");
  this.raw.prepare("INSERT INTO bid_reservations VALUES(1878,'3298',650,'uncertain')").run();
 }
 prepare(sql){return {bind:(...args)=>({sql,args,first:async()=>this.raw.prepare(sql).get(...args)??null})}}
 async batch(stmts){
  this.raw.exec('BEGIN IMMEDIATE');
  try{const x=stmts.map(s=>({results:this.raw.prepare(s.sql).all(...s.args)}));this.raw.exec('COMMIT');return x}
  catch(e){this.raw.exec('ROLLBACK');throw e}
 }
 current(){return this.raw.prepare("SELECT state FROM bid_reservations WHERE problem_id='3298'").get().state}
 receipts(){return this.raw.prepare('SELECT COUNT(*) n FROM sprite_bid_receipts').get().n}
 close(){this.raw.close()}
}
const options=(db,records=[official()],extras={})=>({db,problemId:'3298',amountCents:650,observedAt:'2026-11-23T03:10:00.000Z',
 collectAuthoritativeRecords:async()=>({source:'authenticated_private_marketplace_collector',identity_verified:true,records,coverage_complete:true}),
 verifyExactReceipt:async r=>r.bid_id==='BID-REAL-SHAPED-100'&&r.problem_id==='3298'&&r.agent_id===1878&&r.amount_cents===650,
 ...extras});
test('UNRESOLVED: absence of receipts does NOT establish a failed bid',()=>{
 const r=classifySpriteReceiptEvidence({...expected,records:[],coverageComplete:false});
 assert.equal(r.state,'unresolved');assert.equal(r.confirmed,false);assert.equal(r.may_resubmit,false);
});
test('UNRESOLVED: user-reported success cannot be an authoritative receipt',()=>{
 const r=classifySpriteReceiptEvidence({...expected,records:[{source_type:'user_reported_ui_ack',reported_message:'Bid submitted'}]});
 assert.equal(r.state,'unresolved');assert.equal(r.may_resubmit,false);
});
test('UNRESOLVED: wrong agent, amount, or task not accepted as exact receipt',()=>{
 for(const patch of [{agent_id:1879},{amount_cents:700},{problem_id:'9999'}]){
  const r=classifySpriteReceiptEvidence({...expected,records:[official({bid:{...official().bid,...patch}})]});
  assert.equal(r.state,'unresolved');assert.equal(r.may_resubmit,false);
 }
});
test('UNRESOLVED: contradictory bid IDs never resolve',()=>{
 const r=classifySpriteReceiptEvidence({...expected,records:[official(),official({bid:{...official().bid,bid_id:'BID-DIFFERENT-101'}})]});
 assert.equal(r.reason,'multiple_conflicting_bid_ids');
});
test('UNRESOLVED: mixed weak and official records block automatic promotion',()=>{
 const r=classifySpriteReceiptEvidence({...expected,records:[official(),{source_type:'public_task_page',authenticated:false}]});
 assert.equal(r.reason,'mixed_weak_and_authoritative_evidence');
});
test('UNRESOLVED: a matching authenticated record is a candidate, not itself confirmed',()=>{
 const r=classifySpriteReceiptEvidence({...expected,records:[official()]});
 assert.equal(r.state,'exact_receipt_candidate');assert.equal(r.confirmed,false);assert.equal(r.may_resubmit,false);
});
test('REAL SQLITE: only separate trusted official-source verification can mark #3298 submitted',async()=>{
 const db=new Ledger();
 try{
  const r=await reconcileSpriteUncertainBid(options(db));
  assert.equal(r.state,'confirmed_submitted');assert.equal(r.confirmed,true);
  assert.equal(r.may_resubmit,false);assert.equal(db.current(),'submitted');assert.equal(db.receipts(),1);
 }finally{db.close()}
});
test('REAL SQLITE: unresolved empty result preserves reservation; no synthetic receipt',async()=>{
 const db=new Ledger();
 try{
  const r=await reconcileSpriteUncertainBid(options(db,[]));
  assert.equal(r.state,'unresolved');assert.equal(db.current(),'uncertain');assert.equal(db.receipts(),0);
 }finally{db.close()}
});
test('REAL SQLITE: upstream 403/connection failure preserves uncertain',async()=>{
 const db=new Ledger();
 try{
  const r=await reconcileSpriteUncertainBid(options(db,[],{collectAuthoritativeRecords:async()=>{throw Error('HTTP 403')}}));
  assert.equal(r.reason,'authoritative_marketplace_unavailable');
  assert.equal(db.current(),'uncertain');
 }finally{db.close()}
});
test('REAL SQLITE: claimed official record without independent private verification remains uncertain',async()=>{
 const db=new Ledger();
 try{
  const r=await reconcileSpriteUncertainBid(options(db,[official()],{verifyExactReceipt:async()=>false}));
  assert.equal(r.reason,'receipt_authenticity_not_verified');assert.equal(db.current(),'uncertain');
 }finally{db.close()}
});
test('REAL SQLITE: claimed private collector without independent identity verification remains uncertain',async()=>{
 const db=new Ledger();
 try{
  const r=await reconcileSpriteUncertainBid(options(db,[official()],{
   collectAuthoritativeRecords:async()=>({source:'authenticated_private_marketplace_collector',identity_verified:false,records:[official()]})
  }));
  assert.equal(r.reason,'marketplace_collector_provenance_missing');assert.equal(db.current(),'uncertain');
 }finally{db.close()}
});
test('REAL SQLITE: prior conflicting receipt rolls back reservation UPDATE',async()=>{
 const db=new Ledger();
 try{
  db.raw.prepare("INSERT INTO sprite_bid_receipts VALUES('3298','BID-OLD-CONFLICT',650,'old','2026-11-23T03:00:00.000Z')").run();
  const r=await reconcileSpriteUncertainBid(options(db));
  assert.equal(r.reason,'receipt_transaction_failed');
  assert.equal(db.current(),'uncertain');assert.equal(db.receipts(),1);
 }finally{db.close()}
});
test('REAL SQLITE: concurrent 24 reconcilers only one can promote',async()=>{
 const db=new Ledger();
 try{
  const out=await Promise.all(Array.from({length:24},()=>reconcileSpriteUncertainBid(options(db))));
  assert.equal(out.filter(x=>x.confirmed).length,1);
  assert.equal(db.current(),'submitted');assert.equal(db.receipts(),1);
 }finally{db.close()}
});
test('REAL SQLITE: already submitted cannot be resubmitted or insert another receipt',async()=>{
 const db=new Ledger();
 try{
  const a=await reconcileSpriteUncertainBid(options(db));
  const b=await reconcileSpriteUncertainBid(options(db));
  assert.equal(a.confirmed,true);assert.equal(b.confirmed,false);
  assert.equal(b.reason,'reservation_not_exactly_uncertain');
  assert.equal(db.receipts(),1);
 }finally{db.close()}
});
test('REAL SQLITE: counterfeit record with authenticated=true does not bypass trusted receipt verifier',async()=>{
 const db=new Ledger();
 try{
  const r=await reconcileSpriteUncertainBid(options(db,[official({bid:{...official().bid,bid_id:'BID-FORGED-101'}})]));
  assert.equal(r.reason,'receipt_authenticity_not_verified');
  assert.equal(db.current(),'uncertain');
 }finally{db.close()}
});
test('REAL SQLITE: malformed caller data or missing trusted services fail closed',async()=>{
 const db=new Ledger();
 try{
  for(const changes of [{amountCents:700},{problemId:'invalid'},{observedAt:'soon'},
    {verifyExactReceipt:null},{collectAuthoritativeRecords:null}]){
    const r=await reconcileSpriteUncertainBid(options(db,[official()],changes));
    assert.equal(r.confirmed,false);assert.equal(db.current(),'uncertain');
  }
 }finally{db.close()}
});
