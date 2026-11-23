import test from "node:test";
import assert from "node:assert/strict";
import {runScheduledScan,qualifyTask,needsDetail} from "../worker.mjs";
const base="https://clawhunt.store";
const hook="https://gm-flash.saevond.workers.dev/cph-webhook";
function fixture({agentId=1878,pages={},details={},publicPages={}}={}){
 const calls=[],writes=[];
 const env={CPH_API_KEY:"cph_fictional_test_key",BID_LEDGER:{prepare(sql){assert.match(sql,/INSERT INTO scan_status/);return {bind(...args){return {async run(){writes.push(args);return {success:true}}}}}}}};
 const mock=async(url,opts)=>{
  const u=new URL(url),auth=new Headers(opts.headers).get("authorization");
  calls.push({url:String(url),method:opts.method,auth:!!auth});
  assert.equal(u.origin,base);
  assert.equal(opts.method,"GET");
  if(u.pathname==="/api/v1/me")return Response.json({data:{agent:{id:agentId,name:"Sprite",admission_status:"approved",webhook_url:hook}}});
  if(u.pathname==="/api/v1/problems"){
   assert.ok(auth);
   const page=u.searchParams.get("page")||"1";
   return Response.json({data:{problems:pages[page]||pages["1"]||[]}});
  }
  if(u.pathname==="/api/problems/"){
   assert.equal(auth,null,"public requests must not carry agent credentials");
   const category=u.searchParams.get("category");
   if(!Object.hasOwn(publicPages,category))return new Response("",{status:503});
   return Response.json({data:{problems:publicPages[category]}});
  }
  const m=u.pathname.match(/^\/api\/v1\/problems\/(\d+)$/);
  if(m){assert.ok(auth);if(!Object.hasOwn(details,m[1]))return new Response("",{status:404});return Response.json({data:{problem:details[m[1]]}})}
  throw Error("unexpected request");
 };
 return {env,mock,calls,writes}
}
const row=(id,escrow_status="held",budget_cents=2000,extra={})=>({id,status:"open",escrow_status,budget_cents,currency:"USD",...extra});
async function run(f){const saved=globalThis.fetch;globalThis.fetch=f.mock;try{return await runScheduledScan(f.env)}finally{globalThis.fetch=saved}}
test("scheduled scan distinguishes funded and non-escrow candidates only after authenticated details",async()=>{
 const f=fixture({pages:{1:[row(1,"held",2000,{description:"FICTIONAL_PRIVATE_CANARY"}),row(2,"pending",3000),row(3,"held",499),row(4,"held",10000001),row(5,"held",3500,{simulated:true})]},details:{1:row(1),2:row(2,"pending",3000)}});
 const r=await run(f);
 assert.equal(r.outcome,"scanned");assert.equal(r.records_examined,5);assert.deepEqual(r.candidate_ids,["2","1"]);
 assert.deepEqual(r.diagnostics.non_escrow_candidate_ids,["2"]);assert.equal(r.funded_candidates,1);assert.equal(r.bids_submitted,0);
 assert.equal(r.diagnostics.detail_probes.length,2);assert.equal(f.writes.length,1);
 assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE_CANARY"));
});
test("scheduled scan refuses mismatched identity",async()=>{
 const f=fixture({agentId:999});const r=await run(f);assert.equal(r.outcome,"unavailable");assert.deepEqual(r.candidate_ids,[]);assert.equal(f.calls.length,1);assert.equal(f.writes.length,1)
});
test("scheduled scan cannot proceed without persistent storage",async()=>{
 await assert.rejects(runScheduledScan({}),/ledger unavailable/);
});
test("pagination counts unique records, stops repeat pages, separates public failures",async()=>{
 const page=start=>Array.from({length:20},(_,i)=>row(start+i,i===0?"held":"pending",2000,{title:"FICTIONAL_PRIVATE_TITLE"}));
 const p1=page(1),p2=page(21);
 const details=Object.fromEntries([...p1,...p2].map(x=>[x.id,x]));
 const f=fixture({pages:{1:p1,2:p2,3:p2},details});const r=await run(f);
 assert.equal(r.records_examined,60);assert.equal(r.diagnostics.unique_records,40);assert.equal(r.diagnostics.duplicate_records,20);
 assert.equal(r.diagnostics.pages_requested,3);assert.equal(r.diagnostics.detail_probes.length,10);
 assert.equal(r.diagnostics.complete_market_scan,false);assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE_TITLE"));
 assert.equal(r.diagnostics.public_discovery.length,5);assert.ok(r.diagnostics.public_discovery.every(x=>x.status==="unavailable"));
});
test("ignored pagination never counts repeat pages as fresh coverage",async()=>{
 const f=fixture({pages:{1:Array.from({length:20},(_,i)=>row(i+1,"pending"))}});const r=await run(f);
 assert.equal(r.diagnostics.unique_records,20);assert.equal(r.diagnostics.pages_requested,2);assert.equal(r.diagnostics.second_page_probe,"no_new_ids");
 assert.equal(r.funded_candidates,0);assert.equal(r.diagnostics.non_escrow_candidates,0)
});
test("unauthenticated public listing cannot qualify alone; detail probes include public discoveries",async()=>{
 const f=fixture({pages:{1:Array.from({length:20},(_,i)=>row(i+1,"pending"))},publicPages:{data:[row(100,"held",3000,{description:"FICTIONAL_PRIVATE_PUBLIC"}),row(101,"held",5000)],"ml-ai":[row(100,"held",3000)],backend:[]},details:{100:row(100,"pending",3000)}});
 const r=await run(f);assert.equal(r.funded_candidates,0);assert.deepEqual(r.diagnostics.non_escrow_candidate_ids,["100"]);
 assert.ok(r.diagnostics.detail_probes.some(x=>x.problem_id==="101"&&x.unavailable===true));
 assert.ok(f.calls.filter(x=>x.url.includes("/api/problems/")).every(x=>!x.auth));
 assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE_PUBLIC"))
});
test("missing listing amounts receive bounded detail checks without converting unknown units or retaining free text",async()=>{
 const f=fixture({pages:{1:[1,2,3,4].map(id=>({id,status:"open",budget:25,description:"FICTIONAL_PRIVATE_LIST"}))},details:{1:row(1,"held",2500,{description:"FICTIONAL_PRIVATE_DETAIL"}),2:{id:2,status:"open",budget:25,escrow:"FICTIONAL_PRIVATE_UNVERIFIED"}}});const r=await run(f);
 assert.equal(r.diagnostics.detail_probes.length,4);assert.deepEqual(r.candidate_ids,["1"]);
 assert.equal(r.diagnostics.listing_funding_field_shapes.budget.number,4);
 assert.equal(r.diagnostics.detail_probes[1].field_shapes.escrow,"string");assert.equal(r.diagnostics.detail_probes[1].qualified,false);
 assert.ok(!JSON.stringify(r).includes("FICTIONAL_PRIVATE"));assert.ok(!JSON.stringify(f.writes).includes("FICTIONAL_PRIVATE"))
});
test("unescrowed jobs need no opt-in but still require USD budget, open status and non-simulation",()=>{
 const x=row(1,"unfunded",2500);
 assert.equal(qualifyTask(x,"1",2000).eligible,true);
 const q=qualifyTask(x,"1",2000,true);
 assert.equal(q.eligible,true);assert.equal(q.funding_assessment,"unverified_or_unfunded");assert.equal(q.payment_guaranteed,false);
 for(const invalid of [{...x,currency:"EUR"},{...x,budget_cents:undefined},{...x,status:"closed"},{...x,simulated:true}]){
  assert.equal(qualifyTask(invalid,"1",2000).eligible,false)
 }
 for(const allowed of [{...x,escrow_status:"refunded"},{...x,escrow_status:"held",funded:false},{...x,escrow_status:undefined}]){
  assert.equal(qualifyTask(allowed,"1",2000).eligible,true)
 }
 assert.equal(qualifyTask(x,"1",2501).eligible,false);
 assert.equal(qualifyTask(x,"1",499).eligible,false);
 assert.equal(needsDetail(x),true);
});

test("unknown listing status triggers detail review, not automatic qualification",async()=>{
 const f=fixture({pages:{1:[{id:501,currency:"USD",escrow_status:"none"},{id:502,currency:"USD",escrow_status:"none"},{id:503,status:"closed",currency:"USD",escrow_status:"none"}]},details:{501:row(501,"none",2500),502:{id:502,currency:"USD",escrow_status:"none",budget_cents:2500}}});
 const r=await run(f);
 assert.deepEqual(r.diagnostics.non_escrow_candidate_ids,["501"]);
 assert.deepEqual(r.candidate_ids,["501"]);
 assert.equal(r.diagnostics.detail_probes.length,2);
 assert.equal(r.diagnostics.detail_probes.find(x=>x.problem_id==="502").qualification_stage,"rejected_identity_status_or_simulation");
 assert.ok(!f.calls.some(x=>x.url.endsWith("/503")));
 assert.equal(r.bids_submitted,0);
});
