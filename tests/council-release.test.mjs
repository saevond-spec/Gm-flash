import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalBidIntent} from '../council-preflight.mjs';
import {authorizeAndReserveBid} from '../council-release.mjs';

const clock=1800000000;
const intent=()=>({agent_id:1878,problem_id:'9951',amount_cents:750,
 verified_budget_cents:1200,verified_floor_cents:500,currency:'USD',incremental_cost_cents:0,
 proposal_sha256:'a'.repeat(64),scope_sha256:'b'.repeat(64),nonce:'c'.repeat(32),created_at:clock});
const approval=(intent,reviewer)=>({reviewer,decision:'approve',canonical_intent:canonicalBidIntent(intent),
 problem_id:intent.problem_id,amount_cents:intent.amount_cents,nonce:intent.nonce,
 approved_at:clock,expires_at:clock+500});
function mockD1(){
 const state={reserved:new Map(),nonces:new Set(),batches:0};
 const prepare=(sql)=>({bind(...args){return {sql,args}}});
 const batch=async(stmts)=>{
   state.batches++;
   const [res,used]=stmts;
   const problemId=res.args[0],amount=res.args[1],nonce=used.args[0];
   if(state.nonces.has(nonce))throw Error('UNIQUE nonce constraint');
   if(state.reserved.has(problemId)||[...state.reserved.entries()].some(([id,x])=>id!=='3298'&&(x.state==='uncertain'||x.state==='reserved'))) {
     // A real D1 INSERT ... SELECT returns no reservation, but nonce statement
     // still executes; fail closed, without allowing submission.
     return [{results:[]},{results:[]}];
   }
   state.reserved.set(problemId,{amount,state:'reserved'});state.nonces.add(nonce);
   return [{results:[{problem_id:problemId}]},{results:[{nonce}]}];
 };
 return {state,prepare,batch};
}
function deps(override={}){
 const x=intent(),db=mockD1();
 const obj={intent:x,mother:approval(x,'mother'),nova:approval(x,'nova'),control:approval(x,'chatgpt_operator'),db,nowSec:clock+1,
 verifyMother:async()=>true,verifyNova:async()=>true,verifyControl:async()=>true,
 readLedger:async()=>({available:true,blocking_unresolved_bid:false,existing_reservation:false,nonce_seen:false}),
 independentFinalCheck:async()=>true,...override};
 return {args:obj,db};
}
test('three verified reviewers + fresh market data reserve one bid, never submit it',async()=>{
 const {args,db}=deps();
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.state,'reserved_for_one_submission');
 assert.equal(r.can_submit,true);assert.equal(r.reserved,true);
 assert.equal(r.requires_receipt_reconciliation,true);
 assert.equal(db.state.batches,1);
 assert.equal(db.state.reserved.size,1);assert.equal(db.state.nonces.size,1);
});
test('same nonce fails closed on second attempt',async()=>{
 const {args,db}=deps();
 assert.equal((await authorizeAndReserveBid(args)).reserved,true);
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);assert.equal(r.reason,'atomic_reservation_failed');
 assert.equal(db.state.reserved.size,1);
});
test('legacy uncertain #3298 remains locked but does not block a new distinct task',async()=>{
 const {args,db}=deps();
 db.state.reserved.set('3298',{amount:650,state:'uncertain'});
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.state,'reserved_for_one_submission');
 assert.equal(db.state.reserved.get('3298').state,'uncertain');
 assert.equal(db.state.reserved.get('9951').state,'reserved');
});
test('another NEW unresolved reservation blocks further bids',async()=>{
 const {args,db}=deps();
 db.state.reserved.set('7777',{amount:700,state:'uncertain'});
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);
 assert.equal(r.reason,'reservation_or_nonce_not_acquired');
 assert.equal(db.state.nonces.size,0);
});
test('untrusted reviewers cannot promote a preflight',async()=>{
 const {args,db}=deps({verifyNova:async()=>false});
 const r=await authorizeAndReserveBid(args);assert.equal(r.can_submit,false);
 assert.equal(r.reason,'nova_signature_unverified');assert.equal(db.state.batches,0);
});
test('fresh marketplace rejection holds before any DB insert',async()=>{
 const {args,db}=deps({independentFinalCheck:async()=>false});
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);assert.equal(r.reason,'fresh_market_validation_failed');
 assert.equal(db.state.batches,0);
});
test('missing transactional ledger fails closed',async()=>{
 const {args}=deps({db:null});const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);assert.equal(r.reason,'transactional_ledger_missing');
});
test('missing live eligibility validation fails closed',async()=>{
 const {args}=deps({independentFinalCheck:null});const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);assert.equal(r.reason,'fresh_market_check_missing');
});
test('different amount fails approval equality checks',async()=>{
 const {args,db}=deps();args.intent={...args.intent,amount_cents:900};
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);assert.equal(db.state.batches,0);
});
test('missing control approval fails closed',async()=>{
 const {args,db}=deps({control:null});
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);assert.equal(db.state.batches,0);
});

test('quarantined #3298 cannot be re-bid even with apparent signed approvals',async()=>{
 const {args,db}=deps();
 const legacy={...args.intent,problem_id:'3298'};
 args.intent=legacy;args.mother=approval(legacy,'mother');args.nova=approval(legacy,'nova');args.control=approval(legacy,'chatgpt_operator');
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);assert.equal(r.reason,'legacy_bid_3298_held');
 assert.equal(db.state.batches,0);
});
test('concurrent separately signed tasks reserve at most one unresolved new bid',async()=>{
 const {args,db}=deps();
 const two={...args.intent,problem_id:'9952',nonce:'d'.repeat(32)};
 const args2={...args,intent:two,mother:approval(two,'mother'),nova:approval(two,'nova'),control:approval(two,'chatgpt_operator')};
 const results=await Promise.all([authorizeAndReserveBid(args),authorizeAndReserveBid(args2)]);
 assert.equal(results.filter(r=>r.reserved).length,1);
 assert.equal(results.filter(r=>!r.can_submit).length,1);
 assert.equal(db.state.reserved.size,1);
 assert.equal(db.state.nonces.size,1);
});

test('MISSING MOTHER: no reservation or nonce can be consumed',async()=>{
 const {args,db}=deps({mother:null});
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.reason,'mother_approval_missing_or_mismatched');
 assert.equal(r.can_submit,false);assert.equal(db.state.batches,0);
});
test('BAD MOTHER: independent proof failure prevents any ledger reservation',async()=>{
 const {args,db}=deps({verifyMother:async()=>false});
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.reason,'mother_signature_unverified');
 assert.equal(db.state.batches,0);
});
