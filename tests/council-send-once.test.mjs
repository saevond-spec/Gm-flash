import test from 'node:test';
import assert from 'node:assert/strict';
import {sendReservedBidOnce} from '../council-release.mjs';
import {createHash} from 'node:crypto';
const clock=1800000000;
const proposalText='Clean the fictional CSV, verify totals and supply reproducible arithmetic checks.';
const proposalHash=createHash('sha256').update(proposalText).digest('hex');

const grant=()=>({state:'reserved_for_one_submission',agent_id:1878,problem_id:'9951',
 amount_cents:750,nonce:'c'.repeat(32),intent_sha256:'a'.repeat(64),proposal_sha256:proposalHash,valid_until_sec:clock+300});
function ledger({state='reserved',wrongNonce=false}={}){
 const entry={agent_id:1878,problem_id:'9951',amount_cents:750,state,
   nonce:wrongNonce?'d'.repeat(32):'c'.repeat(32),intent_sha256:'a'.repeat(64)};
 let updates=0;
 return {entry,get updates(){return updates},prepare(sql){
  assert.match(sql,/UPDATE bid_reservations/);
  return {bind(pid,cents,nonce,noncePid,nonceCents,hash){
   return {async first(){
    updates++;
    if(entry.state!=='reserved'||entry.problem_id!==pid||entry.amount_cents!==cents
      ||entry.nonce!==nonce||noncePid!==pid||nonceCents!==cents
      ||entry.intent_sha256!==hash)return null;
    entry.state='uncertain';
    return {problem_id:pid};
   }};
  }};
 }};
}
test('exact reserved grant sends once, marks uncertain before transport',async()=>{
 const db=ledger();let calls=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:grant(),send:async()=>{
   assert.equal(db.entry.state,'uncertain');calls++;return {status:200};
 }});
 assert.equal(r.attempted,true);assert.equal(r.confirmed,false);
 assert.equal(r.state,'uncertain');assert.equal(r.upstream_status,200);
 assert.equal(calls,1);
});
test('same permit cannot submit twice, including concurrency',async()=>{
 const db=ledger();let calls=0;
 const send=async()=>{calls++;return {status:201}};
 const results=await Promise.all([
  sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:grant(),send}),
  sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:grant(),send})
 ]);
 assert.equal(results.filter(x=>x.attempted).length,1);
 assert.equal(calls,1);assert.equal(db.entry.state,'uncertain');
});
test('transport exception remains uncertain; no retry',async()=>{
 const db=ledger();let calls=0;
 const send=async()=>{calls++;throw Error('Fictional dropped response')};
 const a=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:grant(),send});
 const b=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:grant(),send});
 assert.equal(a.attempted,true);assert.equal(a.confirmed,false);
 assert.equal(b.attempted,false);assert.equal(calls,1);
});
test('wrong nonce never invokes marketplace sender',async()=>{
 const db=ledger({wrongNonce:true});let calls=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:grant(),send:async()=>{calls++}});
 assert.equal(r.attempted,false);assert.equal(calls,0);assert.equal(db.entry.state,'reserved');
});
test('previously uncertain reservation never invokes sender',async()=>{
 const db=ledger({state:'uncertain'});let calls=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:grant(),send:async()=>{calls++}});
 assert.equal(r.attempted,false);assert.equal(calls,0);
});
test('legacy #3298 cannot send with a fabricated grant',async()=>{
 const db=ledger();let calls=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:{...grant(),problem_id:'3298'},send:async()=>{calls++}});
 assert.equal(r.attempted,false);assert.equal(calls,0);assert.equal(db.updates,0);
});
test('untrusted missing sender is rejected without DB operation',async()=>{
 const db=ledger();
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,proposalText,grant:grant(),send:null});
 assert.equal(r.attempted,false);assert.equal(db.updates,0);
});

test('modified proposal text cannot reach marketplace or mutate reservation',async()=>{
 const db=ledger();let calls=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,grant:grant(),proposalText:'A different text with valid length',send:async()=>{calls++}});
 assert.equal(r.state,'proposal_hash_mismatch');assert.equal(calls,0);assert.equal(db.updates,0);
});
test('missing approved proposal text fails before DB claim',async()=>{
 const db=ledger();let calls=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,nowSec:clock+1,grant:grant(),send:async()=>{calls++}});
 assert.equal(r.state,'proposal_missing_or_out_of_bounds');assert.equal(calls,0);assert.equal(db.updates,0);
});

test('delayed transport rejects an expired council approval before DB claim',async()=>{
 const db=ledger();let sends=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,grant:grant(),proposalText,nowSec:clock+301,send:async()=>{sends++}});
 assert.equal(r.attempted,false);assert.equal(r.state,'approval_expired_before_send');
 assert.equal(sends,0);assert.equal(db.updates,0);
});
test('exact expiry boundary rejects sending',async()=>{
 const db=ledger();let sends=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock+1,grant:grant(),proposalText,nowSec:clock+300,send:async()=>{sends++}});
 assert.equal(r.state,'approval_expired_before_send');
 assert.equal(sends,0);assert.equal(db.updates,0);
});
test('missing trusted clock fails closed',async()=>{
 const db=ledger();let sends=0;
 const r=await sendReservedBidOnce({db,grant:grant(),proposalText,nowSec:clock+1,send:async()=>{sends++}});
 assert.equal(r.state,'trusted_clock_unavailable');
 assert.equal(sends,0);assert.equal(db.updates,0);
});

test('clock passes initial check but expires during D1 reservation: never call marketplace',async()=>{
 let sec=clock+1;const db=ledger();let sends=0;
 const original=db.prepare.bind(db);
 db.prepare=(sql)=>({bind(...args){const stmt=original(sql).bind(...args);return {async first(){const row=await stmt.first();sec=clock+301;return row;}}}});
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>sec,nowSec:clock+1,grant:grant(),proposalText,send:async()=>{sends++}});
 assert.equal(r.attempted,false);assert.equal(r.state,'claimed_but_approval_expired');
 assert.equal(sends,0);assert.equal(db.entry.state,'uncertain');
});
test('clock becomes unavailable after D1 claim: preserve uncertain ledger, no send',async()=>{
 const db=ledger();let sends=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>{throw Error('clock failure')},nowSec:clock+1,grant:grant(),proposalText,send:async()=>{sends++}});
 assert.equal(r.state,'claimed_but_clock_unavailable');assert.equal(sends,0);assert.equal(db.entry.state,'uncertain');
});
test('clock moves backward after D1 claim: preserve uncertain ledger, no send',async()=>{
 const db=ledger();let sends=0;
 const r=await sendReservedBidOnce({db,trustedNowSec:async()=>clock,nowSec:clock+1,grant:grant(),proposalText,send:async()=>{sends++}});
 assert.equal(r.state,'claimed_but_approval_expired');assert.equal(sends,0);assert.equal(db.entry.state,'uncertain');
});
