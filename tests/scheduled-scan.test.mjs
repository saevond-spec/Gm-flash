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
  if(String(url)===base+"/api/v1/problems/1")return Response.json({data:{problem:{id:1,status:"open",escrow_status:"held",budget_cents:2000,currency:"USD"}}});
  if(String(url).startsWith(base+"/api/v1/problems?"))return Response.json({data:{problems:[
   {id:1,status:"open",escrow_status:"held",currency:"USD",budget_cents:2000,description:"FICTIONAL_PRIVATE_CANARY"},
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
 try{const r=await runScheduledScan(f.env);assert.equal(r.outcome,"scanned");assert.equal(r.records_examined,5);assert.deepEqual(r.candidate_ids,["1"]);assert.equal(r.bids_submitted,0);assert.ok(f.calls.length>=2);assert.ok(f.calls.every(c=>c.method==="GET"));assert.equal(f.writes.length,1);assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE_CANARY"))}
 finally{globalThis.fetch=saved}
});
test("scheduled scan refuses mismatched agent and writes no candidate IDs",async()=>{
 const f=fixture(999),saved=globalThis.fetch;globalThis.fetch=f.mock;
 try{const r=await runScheduledScan(f.env);assert.equal(r.outcome,"unavailable");assert.deepEqual(r.candidate_ids,[]);assert.equal(f.calls.length,1);assert.equal(f.writes.length,1)}finally{globalThis.fetch=saved}
});
test("scheduled scan cannot proceed without persistent storage",async()=>{
 await assert.rejects(runScheduledScan({}),/ledger unavailable/);
});

test("pagination probes expand verified unique IDs and stop on a repeated page",async()=>{
 const f=fixture(),saved=globalThis.fetch;
 const page=(start)=>Array.from({length:20},(_,i)=>({id:start+i,status:"open",currency:"USD",escrow_status:i===0?"held":"pending",budget_cents:2000,title:"FICTIONAL_PRIVATE_TITLE"}));
 globalThis.fetch=async(url,opts)=>{
  if(String(url).endsWith("/me"))return f.mock(url,opts);
  f.calls.push({url:String(url),method:opts.method});
  if(String(url).includes("/api/problems/"))return Response.json([]);
  const detail=String(url).match(new RegExp('/api/v1/problems/([0-9]+)
  if(detail){const id=Number(detail[1]);return Response.json({data:{problem:{id,status:"open",currency:"USD",escrow_status:"held",budget_cents:2000}}});}
  const n=Number(new URL(url).searchParams.get("offset")??0);
  return Response.json({data:{problems:page(n>=20?21:1)}});
 };
 try{
  const r=await runScheduledScan(f.env);
  assert.equal(r.records_examined,60);assert.equal(r.diagnostics.unique_records,40);
  assert.equal(r.diagnostics.duplicate_records,20);assert.ok(r.diagnostics.pages_requested>=3);
  assert.deepEqual(r.candidate_ids,["1","21"]);assert.equal(r.diagnostics.rejections.escrow_not_confirmed_held,38);
  assert.equal(r.diagnostics.complete_market_scan,false);assert.ok(f.calls.every(x=>x.method==="GET"));assert.ok(f.calls.filter(x=>x.url.includes("/api/v1/problems?")).every(x=>x.url.includes("offset=")&&!x.url.includes("page=")));
  assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE_TITLE"));
 }finally{globalThis.fetch=saved}
});
test("ignored pagination never counts repeat page as fresh coverage",async()=>{
 const f=fixture(),saved=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  if(String(url).endsWith("/me"))return f.mock(url,opts);
  return Response.json({data:{problems:Array.from({length:20},(_,i)=>({id:i+1,status:"open",escrow_status:"pending",budget_cents:2000}))}});
 };
 try{const r=await runScheduledScan(f.env);assert.equal(r.diagnostics.unique_records,20);assert.equal(r.diagnostics.pages_requested,2);assert.equal(r.diagnostics.second_page_probe,"no_new_ids");assert.equal(r.funded_candidates,0)}finally{globalThis.fetch=saved}
});

test("missing listing funding fields trigger bounded detail checks, without inferring units or copying private material",async()=>{
 const f=fixture(),saved=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  if(String(url).endsWith("/me"))return f.mock(url,opts);
  f.calls.push({url:String(url),method:opts.method});
  if(String(url).includes("/api/v1/problems?"))return Response.json({data:{problems:[1,2,3,4].map(id=>({id,status:"open",budget:25,description:"FICTIONAL_PRIVATE_LIST"}))}});
  const id=Number(String(url).split("/").pop());
  return Response.json({data:{problem:id===1?{id,status:"open",budget_cents:2500,escrow_status:"held",description:"FICTIONAL_PRIVATE_DETAIL"}:{id,status:"open",budget:25,escrow:"FICTIONAL_PRIVATE_UNVERIFIED"}}});
 };
 try{
  const r=await runScheduledScan(f.env);
  assert.equal(r.diagnostics.detail_probes.length,3);
  assert.deepEqual(r.candidate_ids,["1"]);
  assert.equal(r.diagnostics.listing_funding_field_shapes.budget.number,4);
  assert.equal(r.diagnostics.detail_probes[1].field_shapes.escrow,"string");
  assert.equal(r.diagnostics.detail_probes[1].qualified,false);
  assert.ok(!JSON.stringify(r).includes("FICTIONAL_PRIVATE"));
  assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE"));
  assert.ok(f.calls.every(x=>x.method==="GET"));
 }finally{globalThis.fetch=saved}
});
));
  if(detail){const id=Number(detail[1]);return Response.json({data:{problem:{id,status:"open",currency:"USD",escrow_status:"held",budget_cents:2000}}});}
  const n=Number(new URL(url).searchParams.get("offset")??0);
  return Response.json({data:{problems:page(n>=20?21:1)}});
 };
 try{
  const r=await runScheduledScan(f.env);
  assert.equal(r.records_examined,60);assert.equal(r.diagnostics.unique_records,40);
  assert.equal(r.diagnostics.duplicate_records,20);assert.ok(r.diagnostics.pages_requested>=3);
  assert.deepEqual(r.candidate_ids,["1","21"]);assert.equal(r.diagnostics.rejections.escrow_not_confirmed_held,38);
  assert.equal(r.diagnostics.complete_market_scan,false);assert.ok(f.calls.every(x=>x.method==="GET"));assert.ok(f.calls.filter(x=>x.url.includes("/api/v1/problems?")).every(x=>x.url.includes("offset=")&&!x.url.includes("page=")));
  assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE_TITLE"));
 }finally{globalThis.fetch=saved}
});
test("ignored pagination never counts repeat page as fresh coverage",async()=>{
 const f=fixture(),saved=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  if(String(url).endsWith("/me"))return f.mock(url,opts);
  return Response.json({data:{problems:Array.from({length:20},(_,i)=>({id:i+1,status:"open",escrow_status:"pending",budget_cents:2000}))}});
 };
 try{const r=await runScheduledScan(f.env);assert.equal(r.diagnostics.unique_records,20);assert.equal(r.diagnostics.pages_requested,2);assert.equal(r.diagnostics.second_page_probe,"no_new_ids");assert.equal(r.funded_candidates,0)}finally{globalThis.fetch=saved}
});

test("missing listing funding fields trigger bounded detail checks, without inferring units or copying private material",async()=>{
 const f=fixture(),saved=globalThis.fetch;
 globalThis.fetch=async(url,opts)=>{
  if(String(url).endsWith("/me"))return f.mock(url,opts);
  f.calls.push({url:String(url),method:opts.method});
  if(String(url).includes("/api/v1/problems?"))return Response.json({data:{problems:[1,2,3,4].map(id=>({id,status:"open",budget:25,description:"FICTIONAL_PRIVATE_LIST"}))}});
  const id=Number(String(url).split("/").pop());
  return Response.json({data:{problem:id===1?{id,status:"open",budget_cents:2500,escrow_status:"held",description:"FICTIONAL_PRIVATE_DETAIL"}:{id,status:"open",budget:25,escrow:"FICTIONAL_PRIVATE_UNVERIFIED"}}});
 };
 try{
  const r=await runScheduledScan(f.env);
  assert.equal(r.diagnostics.detail_probes.length,3);
  assert.deepEqual(r.candidate_ids,["1"]);
  assert.equal(r.diagnostics.listing_funding_field_shapes.budget.number,4);
  assert.equal(r.diagnostics.detail_probes[1].field_shapes.escrow,"string");
  assert.equal(r.diagnostics.detail_probes[1].qualified,false);
  assert.ok(!JSON.stringify(r).includes("FICTIONAL_PRIVATE"));
  assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE"));
  assert.ok(f.calls.every(x=>x.method==="GET"));
 }finally{globalThis.fetch=saved}
});
