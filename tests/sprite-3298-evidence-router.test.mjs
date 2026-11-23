import test from 'node:test';
import assert from 'node:assert/strict';
import {routeSprite3298Evidence} from '../sprite-3298-evidence-router.mjs';
const task=(body={data:{problem:{bid_count:33}}})=>({
 route:'task_detail',path:'/api/v1/problems/3298',method:'GET',http_status:200,
 agent_id:1878,authenticated_private_collector:true,body
});
const history=(http_status=403,body=null)=>({
 route:'bid_history',path:'/api/v1/problems/3298/bids',method:'GET',
 http_status,agent_id:1878,authenticated_private_collector:true,body
});
const outcomes=(body={data:{outcomes:[]}})=>({
 route:'bid_outcomes',path:'/api/v1/bids/outcomes',method:'GET',
 http_status:200,agent_id:1878,authenticated_private_collector:true,body
});
const bid=(extra={})=>({bid_id:'BID3298_100',problem_id:'3298',agent_id:1878,
 amount_cents:650,status:'submitted',...extra});
test('REAL-LIKE #3298: 33 task bids + 403 history + ambiguous outcome cannot prove bid',()=>{
 const x=routeSprite3298Evidence({observations:[task(),history(),outcomes({data:{outcomes:[{problem_id:'3298',agent_id:1878,status:'submitted'}]}})]});
 assert.equal(x.state,'unresolved');assert.equal(x.confirmed,false);
 assert.equal(x.may_resubmit,false);assert.equal(x.reason,'bid_history_access_denied_without_exact_receipt');
 assert.equal(x.diagnostics.find(q=>q.route==='task_detail').reported_count,33);
});
test('HTTP 403 with empty outcomes never implies submission failed',()=>{
 const x=routeSprite3298Evidence({observations:[history(),outcomes()]});
 assert.equal(x.state,'unresolved');assert.equal(x.may_resubmit,false);
});
test('valid exact bid in authorized outcomes is ONLY independent-verifier candidate',()=>{
 const x=routeSprite3298Evidence({observations:[history(),outcomes({data:{outcomes:[bid()]}})]});
 assert.equal(x.state,'exact_candidate_only');assert.equal(x.candidate_bid_id,'BID3298_100');
 assert.equal(x.confirmed,false);assert.equal(x.may_resubmit,false);
 assert.equal(x.known_denied_routes,true);
});
test('valid nested task bid list is parsed, unlike aggregate-only details',()=>{
 const x=routeSprite3298Evidence({observations:[task({data:{problem:{bid_count:33,bids:[bid()]}}})]});
 assert.equal(x.state,'exact_candidate_only');assert.equal(x.confirmed,false);
});
test('changed proposal status draft is not authenticated submission evidence',()=>{
 const x=routeSprite3298Evidence({observations:[outcomes({data:{outcomes:[bid({status:'draft'})]}})]});
 assert.equal(x.state,'unresolved');assert.equal(x.may_resubmit,false);
});
test('two official routes with contradictory bid IDs remain unresolved',()=>{
 const x=routeSprite3298Evidence({observations:[
   history(200,{data:{bids:[bid()]}}),
   outcomes({data:{outcomes:[bid({bid_id:'BID3298_101'})]}})
 ]});
 assert.equal(x.reason,'conflicting_marketplace_records');
 assert.equal(x.confirmed,false);assert.equal(x.may_resubmit,false);
});
test('wrong task, agent, amount cannot become exact candidate',()=>{
 for(const patch of [{agent_id:1879},{problem_id:'3299'},{amount_cents:999}]){
  const x=routeSprite3298Evidence({observations:[outcomes({data:{outcomes:[bid(patch)]}})]});
  assert.equal(x.state,'unresolved');assert.equal(x.confirmed,false);
 }
});
test('unauthenticated source cannot be promoted even with bid-looking data',()=>{
 const fake=outcomes({data:{outcomes:[bid()]}});fake.authenticated_private_collector=false;
 const x=routeSprite3298Evidence({observations:[fake]});
 assert.equal(x.reason,'authenticated_provenance_incomplete');assert.equal(x.confirmed,false);
});
test('mismatched route path and POST requests rejected, never re-run claim',()=>{
 const fake=history(200,{data:{bids:[bid()]}});fake.method='POST';
 const x=routeSprite3298Evidence({observations:[fake]});
 assert.equal(x.reason,'authenticated_provenance_incomplete');
 assert.equal(x.may_resubmit,false);
});
test('oversized outcome list cannot bypass read-only evidence bound',()=>{
 const x=routeSprite3298Evidence({observations:[outcomes({data:{outcomes:Array.from({length:101},()=>bid())}})]});
 assert.equal(x.state,'unresolved');assert.equal(x.confirmed,false);
});
test('no authenticated individual records remain uncertain even with 0 aggregate task bids',()=>{
 const x=routeSprite3298Evidence({observations:[task({data:{problem:{bid_count:0}}})]});
 assert.equal(x.state,'unresolved');assert.equal(x.may_resubmit,false);
});
test('HTTP 401, 403, 404, 503 are not negative proof of a missing bid',()=>{
 for(const code of [401,403,404,503]){
  const x=routeSprite3298Evidence({observations:[history(code)]});
  assert.equal(x.state,'unresolved');assert.equal(x.confirmed,false);assert.equal(x.may_resubmit,false);
 }
});
test('duplicate exact receipt across two sources remains candidate, never confirmed',()=>{
 const x=routeSprite3298Evidence({observations:[
   history(200,{data:{bids:[bid()]}}),outcomes({data:{outcomes:[bid()]}})
 ]});
 assert.equal(x.state,'exact_candidate_only');assert.equal(x.confirmed,false);
});
test('512 mutated mock route responses never grant submit or resubmit',()=>{
 const obs=[history(),task(),outcomes(),history(200,{data:{bids:[bid()]}}),
   outcomes({data:{outcomes:[bid({status:'draft'})]}})];
 let seed=0x20261122;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0};
 for(let i=0;i<512;i++){
   const x=routeSprite3298Evidence({observations:[obs[rnd()%obs.length]]});
   assert.equal(x.may_resubmit,false);assert.equal(x.confirmed,false);
   assert.equal(x.may_mark_submitted,false);
 }
});
