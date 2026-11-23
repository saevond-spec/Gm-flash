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
   if(state.reserved.has(problemId)||[...state.reserved.values()].some(x=>x.state==='uncertain'||x.state==='reserved')) {
     // A real D1 INSERT ... SELECT returns no reservation, but nonce statement
     // still executes; fail closed, without allowing submission.
     state.nonces.add(nonce);
     return [{results:[]},{results:[{nonce}]}];
   }
   state.reserved.set(problemId,{amount,state:'reserved'});state.nonces.add(nonce);
   return [{results:[{problem_id:problemId}]},{results:[{nonce}]}];
 };
 return {state,prepare,batch};
}
function deps(override={}){
 const x=intent(),db=mockD1();
 const obj={intent:x,nova:approval(x,'nova'),control:approval(x,'chatgpt_operator'),db,nowSec:clock+1,
 verifyNova:async()=>true,verifyControl:async()=>true,
 readLedger:async()=>({available:true,any_unresolved_bid:false,existing_reservation:false,nonce_seen:false}),
 independentFinalCheck:async()=>true,...override};
 return {args:obj,db};
}
test('two verified reviewers + fresh market data reserve one bid, never submit it',async()=>{
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
test('unknown existing reservation blocks any new submission',async()=>{
 const {args,db}=deps();
 db.state.reserved.set('3298',{amount:650,state:'uncertain'});
 const r=await authorizeAndReserveBid(args);
 assert.equal(r.can_submit,false);assert.equal(r.reason,'reservation_or_nonce_not_acquired');
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
