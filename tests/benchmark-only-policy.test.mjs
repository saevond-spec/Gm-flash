import test from "node:test";
import assert from "node:assert/strict";
import {runApprovedBenchmark,BENCHMARK_SCOPE} from "../benchmark-only-policy.mjs";
const identity={id:1878,name:"Sprite",admission_status:"approved",webhook_url:"https://gm-flash.saevond.workers.dev/cph-webhook"};
function make(overrides={}){
 const calls=[];
 const adapters={authenticateOperator:async()=>true,readIdentity:async()=>identity,verifyCouncilApproval:async(scope)=>{assert.equal(scope,BENCHMARK_SCOPE);return true;},reserveProbe:async(scope,seconds)=>{assert.equal(scope,BENCHMARK_SCOPE);assert.equal(seconds,180);return true;},sendBenchmark:async(scope)=>{calls.push(scope);return {status:202};},...overrides};
 return {calls,adapters};
}
for(const [name,overrides] of [
 ["unauthenticated",{authenticateOperator:async()=>false}],
 ["wrong identity",{readIdentity:async()=>({...identity,id:999})}],
 ["wrong webhook",{readIdentity:async()=>({...identity,webhook_url:"https://example.invalid"})}],
 ["not approved",{readIdentity:async()=>({...identity,admission_status:"pending"})}],
 ["missing council approval",{verifyCouncilApproval:async()=>false}],
 ["truthy fake approval",{verifyCouncilApproval:async()=>({approved:true})}],
 ["reservation blocked",{reserveProbe:async()=>false}],
 ["verification failure",{verifyCouncilApproval:async()=>{throw Error("unavailable");}}],
 ["missing adapter",{verifyCouncilApproval:null}]
]){
 test(name+" fails closed",async()=>{const {calls,adapters}=make(overrides);const result=await runApprovedBenchmark(adapters);assert.equal(result.attempted,false);assert.equal(calls.length,0);});
}
test("approved request is zero-spend, benchmark-only, and not a completed score",async()=>{const {calls,adapters}=make();const result=await runApprovedBenchmark(adapters);assert.equal(calls.length,1);assert.deepEqual(calls[0],{agent_id:1878,action:"benchmark_run",amount_cents:0,method:"POST",path:"/api/v1/capability-probe/run"});assert.equal(result.state,"upstream_accepted_unverified");assert.equal(result.confirmed,false);});
test("rate-limited request is not retried",async()=>{let attempts=0;const {adapters}=make({sendBenchmark:async()=>{attempts++;return {status:429};}});const result=await runApprovedBenchmark(adapters);assert.equal(attempts,1);assert.equal(result.state,"rate_limited");});
test("uncertain transport is not retried or confirmed",async()=>{let attempts=0;const {adapters}=make({sendBenchmark:async()=>{attempts++;throw Error("timeout");}});const result=await runApprovedBenchmark(adapters);assert.equal(attempts,1);assert.equal(result.state,"transport_uncertain");assert.equal(result.confirmed,false);});
