import test from "node:test";
import assert from "node:assert/strict";
import {runScheduledScan} from "../worker.mjs";
const base="https://clawhunt.store";
const hook="https://gm-flash.saevond.workers.dev/cph-webhook";
function fixture(agentId=1878){
 const calls=[],writes=[];
 const env={CPH_API_KEY:"cph_fictional_test_key",BID_LEDGER:{prepare(sql){assert.match(sql,/INSERT INTO scan_status/);return {bind(...args){return {async run(){writes.push(args);return {success:true}}}}}}}};
 const mock=async(url,opts)=>{
  calls.push({url:String(url),method:opts.method});
  if(String(url)===base+"/api/v1/me")return Response.json({data:{agent:{id:agentId,name:"Sprite",admission_status:"approved",webhook_url:hook}}});
  if(String(url)===base+"/api/v1/problems")return Response.json({data:{problems:[
   {id:1,status:"open",escrow_status:"held",budget_cents:2000,description:"FICTIONAL_PRIVATE_CANARY"},
   {id:2,status:"open",escrow_status:"pending",budget_cents:3000},
   {id:3,status:"open",escrow_status:"held",budget_cents:1999},
   {id:4,status:"open",escrow_status:"held",budget_cents:10000001},
   {id:5,status:"open",escrow_status:"held",budget_cents:3500,simulated:true}
  ]}});
  throw Error("unexpected request");
 };
 return {env,mock,calls,writes}
}
test("scheduled scan selects eligible metadata only, persists one record and performs GET only",async()=>{
 const f=fixture(),saved=globalThis.fetch;globalThis.fetch=f.mock;
 try{const r=await runScheduledScan(f.env);assert.equal(r.outcome,"scanned");assert.equal(r.records_examined,5);assert.deepEqual(r.candidate_ids,["1"]);assert.equal(r.bids_submitted,0);assert.equal(f.calls.length,2);assert.ok(f.calls.every(c=>c.method==="GET"));assert.equal(f.writes.length,1);assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE_CANARY"))}
 finally{globalThis.fetch=saved}
});
test("scheduled scan refuses mismatched agent and writes no candidate IDs",async()=>{
 const f=fixture(999),saved=globalThis.fetch;globalThis.fetch=f.mock;
 try{const r=await runScheduledScan(f.env);assert.equal(r.outcome,"unavailable");assert.deepEqual(r.candidate_ids,[]);assert.equal(f.calls.length,1);assert.equal(f.writes.length,1)}finally{globalThis.fetch=saved}
});
test("scheduled scan cannot proceed without persistent storage",async()=>{
 await assert.rejects(runScheduledScan({}),/ledger unavailable/);
});
