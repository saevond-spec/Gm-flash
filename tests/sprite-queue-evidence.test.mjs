import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSpriteQueueEvidence} from '../sprite-queue-evidence.mjs';
const now=1800000000;
const opts={authenticated:true,checkedAtSec:now-10,nowSec:now};
const item=(id,patch={})=>({problem_id:id,price_floor_cents:500,budget_cents:1250,own_bid:null,...patch});
test('dynamic queue extracts real-shaped task IDs without hardcoded 4183-4202',()=>{
 const rows=Array.from({length:50},(_,i)=>item(String(6001+i)));
 const r=extractSpriteQueueEvidence({data:{queue:rows}},opts);
 assert.equal(r.state,'inspected');assert.equal(r.records_seen,50);
 assert.equal(r.unique_ids,50);assert.equal(r.price_verified_count,50);
 assert.equal(r.rows[0].problem_id,'6001');assert.equal(r.rows.at(-1).problem_id,'6050');
 assert.equal(r.bid_ready_count,0);
 assert.ok(r.rows.every(x=>x.eligible_for_bid===false));
});
test('50 genuine floor fields without budget cents stay review only',()=>{
 const rows=Array.from({length:50},(_,i)=>item(String(9001+i),{budget_cents:undefined,own_bid:null}));
 const r=extractSpriteQueueEvidence({data:{queue:rows}},opts);
 assert.equal(r.price_verified_count,0);assert.equal(r.review_count,50);
 assert.equal(r.rows[0].price_floor_cents,500);assert.equal(r.rows[0].budget_cents,null);
 assert.equal(r.bid_ready_count,0);
});
test('unverified units (budget USD, generic price, floats) cannot be inferred as cents',()=>{
 for(const patch of [{budget_cents:undefined,budget:15},{budget_cents:undefined,price:1500},
 {budget_cents:12.5},{budget_cents:'1500'},{budget_cents:0}]){
  const r=extractSpriteQueueEvidence({data:{queue:[item('6001',patch)]}},opts);
  assert.equal(r.price_verified_count,0,JSON.stringify(patch));
 }
});
test('stale or unauthenticated queue cannot qualify as evidence',()=>{
 const raw={data:{queue:[item('6001')]}};
 for(const options of [{...opts,authenticated:false},{...opts,checkedAtSec:now-301},
   {...opts,checkedAtSec:now+1}, {...opts,checkedAtSec:undefined}]){
  const r=extractSpriteQueueEvidence(raw,options);
  assert.equal(r.state,'unverified');assert.equal(r.rows.length,0);
 }
});
test('conflicting duplicate row prices or own-bid state quarantine ID',()=>{
 const r=extractSpriteQueueEvidence({queue:[item('7001'),item('7001',{price_floor_cents:600}),item('7002')]},opts);
 assert.deepEqual(r.conflicts,['7001']);assert.equal(r.rows.length,1);
 assert.equal(r.rows[0].problem_id,'7002');
});
test('identical duplicate pages count one task and never claim market completeness',()=>{
 const row=item('7001');
 const r=extractSpriteQueueEvidence({data:{items:[row,row,item('7002')]}},opts);
 assert.equal(r.unique_ids,2);assert.equal(r.records_seen,3);
 assert.equal(r.complete_market_scan,false);assert.equal(r.bid_ready_count,0);
});
test('existing bid and unknown own-bid state do not become eligible',()=>{
 const r=extractSpriteQueueEvidence({data:{queue:[item('7001',{own_bid:{id:'BID-EXAMPLE'}}),item('7002',{own_bid:undefined})]}},opts);
 assert.equal(r.rows[0].own_bid,'present');assert.equal(r.rows[1].own_bid,'unverified');
 assert.ok(r.rows.every(x=>x.eligible_for_bid===false));
});
test('never retain customer titles, descriptions, buyer details, links or credentials',()=>{
 const raw={data:{queue:[item('8001',{title:'SECRET_CUSTOMER_TEST',description:'SECRET_PRIVATE_TEXT',
     buyer:{email:'SECRET_EMAIL'},api_key:'SECRET_KEY',url:'https://secret.invalid'})]}};
 const r=extractSpriteQueueEvidence(raw,opts);const out=JSON.stringify(r);
 for(const word of ['SECRET_CUSTOMER_TEST','SECRET_PRIVATE_TEXT','SECRET_EMAIL','SECRET_KEY','secret.invalid'])
  assert.equal(out.includes(word),false);
});
test('malformed objects or arrays fail closed',()=>{
 for(const raw of [null,{}, {error:'permission denied'}, {data:{queue:{id:'12'}}},
   {data:{queue:Array.from({length:101},(_,i)=>item(String(i+1)))}}]){
  const r=extractSpriteQueueEvidence(raw,opts);assert.equal(r.state,'unverified');assert.equal(r.rows.length,0);
 }
});
