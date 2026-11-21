import test from "node:test";
import assert from "node:assert/strict";
import {reconcile,rehearse,prepareBidPlan} from "../bid-solve.mjs";
test("both actual solver rehearsals generate independently checked outputs",async()=>{
 for(const profile of ["csv_cleanup","arithmetic_reconciliation"]){const p=await rehearse(profile);assert.equal(p.passed,true);assert.equal(p.fixture_only,true);}
});
test("integer reconciliation handles signed cents and rejects unsafe inputs",()=>{
 assert.deepEqual(reconcile([500,-100,20],421),{entries:3,total_cents:420,declared_cents:421,difference_cents:-1,matched:false});
 for(const x of [[1.5],[NaN],[],[100000001]])assert.throws(()=>reconcile(x,0));
});
test("bid plan holds unfunded and uneconomic tasks and does not claim customer completion",async()=>{
 const q={reasons:[],eligible:true};const p=await prepareBidPlan({profile:"csv_cleanup",amount_cents:4000,hours:2,cost_cents:100},q);
 assert.equal(p.readiness,"candidate_for_manual_scope_review");assert.equal(p.quote.estimated_net_if_settled_cents,2900);assert.equal(p.bid_submitted,false);assert.equal(p.task_scope_verified,false);assert.equal(p.customer_solution_completed,false);
 const blocked=await prepareBidPlan({profile:"arithmetic_reconciliation",amount_cents:4000,hours:2,cost_cents:3000},{eligible:false,reasons:["escrow_not_confirmed_held"]});
 assert.equal(blocked.readiness,"hold");assert.ok(blocked.reasons.includes("escrow_not_confirmed_held"));assert.ok(blocked.reasons.includes("nonpositive_net_after_declared_cost"));
 await assert.rejects(prepareBidPlan({profile:"unsupported",amount_cents:4000,hours:2,cost_cents:0},q));
});
