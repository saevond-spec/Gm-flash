import test from "node:test";
import assert from "node:assert/strict";
import {reserveBenchmark,markVerifiedBenchmarkTerminal,RESERVE_SQL,COMPLETE_SQL} from "../benchmark-reservation.mjs";
const nonce="0123456789abcdef0123456789abcdef";
function fakeDb(result){
 const calls=[];
 return {calls,db:{prepare(sql){return {bind(value){return {run:async()=>{calls.push({sql,value});if(result instanceof Error)throw result;return result;}};}};}}};
}
test("reservation requires valid nonce and exactly one changed row",async()=>{
 for(const [result,expected] of [[{success:true,meta:{changes:1}},true],[{success:true,meta:{changes:0}},false],[{success:false,meta:{changes:1}},false],[new Error("unavailable"),false]]){
  const {db,calls}=fakeDb(result);
  assert.equal(await reserveBenchmark(db,nonce),expected);
  assert.deepEqual(calls,[{sql:RESERVE_SQL,value:nonce}]);
 }
 const {db,calls}=fakeDb({success:true,meta:{changes:1}});
 assert.equal(await reserveBenchmark(db,"bad"),false);assert.equal(calls.length,0);
});
test("terminal marking requires trusted verification and matching nonce update",async()=>{
 const {db,calls}=fakeDb({success:true,meta:{changes:1}});
 assert.equal(await markVerifiedBenchmarkTerminal(db,nonce,async()=>false),false);
 assert.equal(await markVerifiedBenchmarkTerminal(db,nonce,async()=>({verified:true})),false);
 assert.equal(calls.length,0);
 assert.equal(await markVerifiedBenchmarkTerminal(db,nonce,async(scope)=>{assert.deepEqual(scope,{agent_id:1878,nonce});return true;}),true);
 assert.deepEqual(calls,[{sql:COMPLETE_SQL,value:nonce}]);
});
