import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker, { qualifyTask, marketObservation } from "../worker.mjs";

const origin="https://gm-flash.saevond.workers.dev";
const hook=origin+"/cph-webhook";
const officialFile="https://clawhunt.store/api/v1/probe-files/test-file-v1.txt";
const fakeEnv=()=>({
  CONTROL_TOKEN:"T".repeat(40),CPH_API_KEY:"cph_test_sprite_only",
  CPH_WEBHOOK_SECRET:"h".repeat(64),AI:{run:async()=>({response:"mock"})}
});
const headers=(secret,body,seconds=Math.floor(Date.now()/1000))=>({
  "Content-Type":"application/json",
  "X-CPH-Probe-Timestamp":String(seconds),
  "X-CPH-Probe-Signature":"sha256="+createHmac("sha256",secret).update(String(seconds)+"."+body).digest("hex")
});
const hookCall=(body,secret=fakeEnv().CPH_WEBHOOK_SECRET,seconds)=>{
  const json=JSON.stringify(body);
  return worker.fetch(new Request(hook,{method:"POST",headers:headers(secret,json,seconds),body:json}),fakeEnv());
};
const auth=(path,body,env=fakeEnv())=>worker.fetch(new Request(origin+path,{
  method:body?"POST":"GET",
  headers:{"Content-Type":"application/json","x-control-token":env.CONTROL_TOKEN},
  body:body?JSON.stringify(body):undefined
}),env);
const savedFetch=globalThis.fetch;
function mockClawhunt(identity=true,task=null){
  const calls=[];
  globalThis.fetch=async (url,opts={})=>{
    calls.push({url:String(url),method:opts.method||"GET"});
    if(String(url)==="https://clawhunt.store/api/v1/me")
      return Response.json({data:{agent:{id:identity?1878:1853,name:identity?"Sprite":"Other",admission_status:"approved",webhook_secret:"s".repeat(64),webhook_url:hook}}});
    if(String(url)==="https://clawhunt.store/api/v1/problems/123")
      return Response.json({data:{problem:task||{id:123,title:"Public demo task",escrow_status:"pending",status:"open",budget:50}}});
    throw new Error("Unexpected fetch: "+url);
  };
  return calls;
}
test("health reveals no secret values",async()=>{
  const r=await worker.fetch(new Request(origin+"/health"),fakeEnv());
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.auto_bidding,false);
  assert.equal(JSON.stringify(body).includes("cph_test"),false);
});
test("unsigned webhook rejected without external fetch",async()=>{
  globalThis.fetch=async()=>{throw Error("must not fetch")};
  try{
    const r=await worker.fetch(new Request(hook,{method:"POST",body:JSON.stringify({event_type:"task_assignment"})}),fakeEnv());
    assert.equal(r.status,401);
  }finally{globalThis.fetch=savedFetch}
});
test("correct HMAC verifies a non-probe event without executing it",async()=>{
  const r=await hookCall({event_type:"task_assignment",id:"dummy"});
  assert.equal(r.status,200);
  const b=await r.json();
  assert.equal(b.verified,true);assert.equal(b.action,"none");
});
test("expired HMAC rejected",async()=>{
  const r=await hookCall({event_type:"task_assignment"},fakeEnv().CPH_WEBHOOK_SECRET,Math.floor(Date.now()/1000)-601);
  assert.equal(r.status,401);
});
test("signed allowlisted file probe hashes actual fetched bytes",async()=>{
  const data=new TextEncoder().encode("Real bytes with newline\n");
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push(String(url));assert.equal(String(url),officialFile);
    assert.equal(options.redirect,"manual");
    return new Response(data,{status:200,headers:{"content-type":"text/plain"}});
  };
  try{
    const r=await hookCall({event_type:"capability_probe",probe_type:"file_transfer",probe_id:"probe-test",payload:{file_url:officialFile}});
    const b=await r.json();
    assert.equal(r.status,200);assert.equal(b.status,"success");assert.equal(b.probe_id,"probe-test");
    assert.equal(b.result.file_size,data.length);
    assert.equal(b.result.content_preview,"Real bytes with newline\n");
    assert.match(b.result.file_hash,/^sha256:[a-f0-9]{64}$/);
    assert.equal(calls.length,1);
  }finally{globalThis.fetch=savedFetch}
});
test("signed arbitrary download URL rejected",async()=>{
  globalThis.fetch=async()=>{throw Error("unexpected external access")};
  try{
    const r=await hookCall({event_type:"capability_probe",probe_type:"file_transfer",probe_id:"probe-block",payload:{file_url:"https://other.example/file"}});
    assert.equal((await r.json()).status,"error");
  }finally{globalThis.fetch=savedFetch}
});
test("dry run checks Sprite identity but never calls bid endpoint",async()=>{
  const calls=mockClawhunt();
  try{
    const r=await auth("/api/bid-dry-run",{problem_id:"123",amount_cents:5000,message:"Safe testing plan only"});
    const b=await r.json();assert.equal(r.status,200);
    assert.equal(b.request_sent_to_clawhunt,false);
    assert.equal(b.agent_id,1878);
    assert.ok(!calls.some(x=>x.url.includes("/bid")));
  }finally{globalThis.fetch=savedFetch}
});
test("real bid without explicit confirmation cannot be submitted",async()=>{
  const calls=mockClawhunt();
  try{
    const r=await auth("/api/bid",{problem_id:"123",amount_cents:5000,message:"Safe testing plan only"});
    assert.equal(r.status,400);
    assert.ok(!calls.some(x=>x.url.includes("/bid")));
  }finally{globalThis.fetch=savedFetch}
});
test("funding inspection is read-only and treats unknown escrow as unverified",async()=>{
  const calls=mockClawhunt(true,{id:123,title:"Mock task",status:"open",escrow_status:"pending",budget:50});
  try{
    const r=await auth("/api/problem-check",{problem_id:"123"});
    const b=await r.json();assert.equal(r.status,200);
    assert.equal(b.funding_assessment,"unverified_or_unfunded");
    assert.equal(b.request_sent_to_bid_endpoint,false);
    assert.ok(!calls.some(x=>x.url.includes("/bid")));
  }finally{globalThis.fetch=savedFetch}
});
test("different agent identity refuses bid dry run",async()=>{
  const calls=mockClawhunt(false);
  try{
    const r=await auth("/api/bid-dry-run",{problem_id:"123",amount_cents:5000,message:"Safe testing plan only"});
    assert.equal(r.status,502);
    assert.ok(!calls.some(x=>x.url.includes("/bid")));
  }finally{globalThis.fetch=savedFetch}
});


test("model returns usable OpenAI-compatible proposal without submitting bid",async()=>{
  const env=fakeEnv();
  let requestedTokens=0,modelCalls=0;
  env.AI={run:async(model,args)=>{
    modelCalls++;requestedTokens=args.max_tokens;
    return {choices:[{message:{content:"Research the public task, implement a limited solution, and validate with tests."},finish_reason:"stop"}]};
  }};
  const r=await auth("/api/draft",{task:"Analyze a public coding problem and propose a measurable plan without customer files."},env);
  const body=await r.json();
  assert.equal(r.status,200);assert.equal(body.posted,false);
  assert.equal(body.review_required,true);assert.match(body.draft,/validate with tests/);
  assert.equal(requestedTokens,1600);assert.equal(modelCalls,1);
});
test("model reasoning-only response fails closed without fake success",async()=>{
  const env=fakeEnv();
  env.AI={run:async()=>({choices:[{message:{content:null,reasoning:"Private reasoning not a proposal."},finish_reason:"length"}]})};
  const r=await auth("/api/draft",{task:"Review a public work request and generate a trustworthy proposal for the operator."},env);
  const body=await r.json();
  assert.equal(r.status,503);assert.equal(body.model_finish_reason,"length");
  assert.equal(body.draft,undefined);
});


test("visual probe uses downloaded PNG bytes as model input and returns model observation",async()=>{
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,...new Array(24).fill(0)]);
  const url="https://clawhunt.store/api/v1/probe-files/test-image-v1.png";
  const body=JSON.stringify({event_type:"capability_probe",probe_type:"visual_observation",probe_id:"visual-fixture",payload:{image_url:url}});
  const env=fakeEnv();let called=0;
  env.AI={run:async(model,args)=>{
    called++;
    assert.equal(model,"@cf/google/gemma-4-26b-a4b-it");
    const image=args.messages[0].content.find(x=>x.type==="image_url");
    assert.equal(image.image_url.url,"data:image/png;base64,"+Buffer.from(png).toString("base64"));
    return {choices:[{message:{content:"An observation returned by the test double."}}]};
  }};
  globalThis.fetch=async(u,o)=>{assert.equal(String(u),url);assert.equal(o.redirect,"manual");return new Response(png)};
  try{
    const r=await worker.fetch(new Request(hook,{method:"POST",headers:headers(env.CPH_WEBHOOK_SECRET,body),body}),env);
    const result=await r.json();assert.equal(result.status,"success");assert.equal(called,1);
    assert.equal(result.result.description,"An observation returned by the test double.");
  }finally{globalThis.fetch=savedFetch}
});
test("visual probe refuses arbitrary image URL",async()=>{
  globalThis.fetch=async()=>{throw Error("unexpected network fetch")};
  try{
    const r=await hookCall({event_type:"capability_probe",probe_type:"visual_observation",probe_id:"blocked-image",payload:{image_url:"https://example.org/private.png"}});
    assert.equal((await r.json()).status,"error");
  }finally{globalThis.fetch=savedFetch}
});


const fundedFixture=Object.freeze({id:123,status:"bidding",escrow_status:"held",funded:true,budget_cents:5000});
test("eligible held escrow fixture and exact net quote arithmetic",()=>{
  const a=qualifyTask(fundedFixture,"123",5000);
  assert.equal(a.eligible,true);
  assert.equal(a.net_at_quoted_amount_cents,3750);
  assert.equal(a.delivery_capability_verified,false);
});
test("conservative qualification rejects missing or contradictory escrow",()=>{
  for(const patch of [{escrow_status:undefined},{escrow_status:"pending"},{funded:false},{is_funded:false},{is_simulated:true},{simulated:true},{bounty_type:"simulated"},{id:456},{id:undefined},{status:"assigned"},{status:undefined},{budget_cents:undefined},{budget_cents:4999}]){
    assert.equal(qualifyTask({...fundedFixture,...patch},"123",5000).eligible,false,JSON.stringify(patch));
  }
});
test("exhaustive funding/status/simulation/budget matrix rejects unsafe combinations",()=>{
  let cases=0;
  for(const escrow_status of ["held","pending","released",undefined])
  for(const status of ["open","bidding","assigned",undefined])
  for(const funded of [true,false,undefined])
  for(const is_simulated of [true,false])
  for(const budget_cents of [4999,5000,6000,undefined]){
    const task={id:123,escrow_status,status,funded,is_simulated,budget_cents};
    const expected=escrow_status==="held" && ["open","bidding"].includes(status) && funded!==false && is_simulated===false && [5000,6000].includes(budget_cents);
    assert.equal(qualifyTask(task,"123",5000).eligible,expected,JSON.stringify(task));
    cases++;
  }
  assert.equal(cases,384);
  console.log("FUNDING_MATRIX_CASES",cases);
});
test("confirmed bid request for unfunded fixture never reaches marketplace bid endpoint",async()=>{
  const calls=mockClawhunt(true,{...fundedFixture,escrow_status:"pending"});
  try{
    const r=await auth("/api/bid",{problem_id:"123",amount_cents:5000,message:"A valid but unfunded fixture plan",confirm:"PLACE_BID"});
    assert.equal(r.status,409);
    assert.equal((await r.json()).bid_sent,false);
    assert.ok(!calls.some(x=>x.url.endsWith("/bid")));
  }finally{globalThis.fetch=savedFetch}
});
test("funded dry run verifies task and budget but never posts",async()=>{
  const calls=mockClawhunt(true,fundedFixture);
  try{
    const r=await auth("/api/bid-dry-run",{problem_id:"123",amount_cents:2500,message:"Safe fixture delivery plan"});
    const b=await r.json();assert.equal(r.status,200);
    assert.equal(b.qualification.eligible,true);
    assert.equal(b.task_funding_checked,true);
    assert.equal(b.qualification.net_at_quoted_amount_cents,1875);
    assert.ok(!calls.some(x=>x.url.endsWith("/bid")));
  }finally{globalThis.fetch=savedFetch}
});

test("market observer ranks limited listing metadata and never implies delivery capability",()=>{
 const rows=[{id:31,title:"A",status:"open",escrow_status:"held",budget_cents:4000,description:"private test content",buyer:{email:"not-real"}},{id:22,title:"B",status:"open",escrow_status:"pending",budget_cents:9999},{id:33,title:"C",status:"open",escrow_status:"held",budget_cents:10000,simulated:true},{id:34,title:"D",status:"open",escrow_status:"held",budget:9000},{id:31,title:"duplicate"},{id:"invalid"}];
 const x=marketObservation({data:{problems:rows}},"2026-01-01T00:00:00Z");
 assert.equal(x.review_candidates,1);assert.equal(x.valid_unique_records,4);assert.equal(x.observations[0].problem_id,"31");
 assert.equal(x.observations[0].settlement_at_posted_budget_cents,3000);
 assert.equal(x.observations[0].delivery_capability_verified,false);assert.equal(x.complete_market_scan,false);
 assert.equal(x.bids_submitted,0);assert.equal(x.visual_browser_active,false);
 assert.ok(!JSON.stringify(x).includes("private test content"));assert.ok(!JSON.stringify(x).includes("not-real"));
 assert.throws(()=>marketObservation({unknown:[]}));
});
test("market observer only makes identity and listing GET requests; unauthorized request makes none",async()=>{
 const calls=[];globalThis.fetch=async(url,opts={})=>{
  calls.push({url:String(url),method:opts.method||"GET"});
  if(String(url).endsWith("/me"))return Response.json({data:{agent:{id:1878,name:"Sprite",admission_status:"approved",webhook_secret:"s".repeat(64),webhook_url:hook}}});
  if(String(url).endsWith("/problems"))return Response.json({data:{problems:[{id:9,title:"Test",status:"open",escrow_status:"held",budget_cents:4000}]}});
  throw Error("Unexpected request");
 };
 try{
  const denied=await worker.fetch(new Request(origin+"/api/market-observe"),fakeEnv());assert.equal(denied.status,401);assert.equal(calls.length,0);
  const r=await auth("/api/market-observe");assert.equal(r.status,200);assert.equal((await r.json()).review_candidates,1);
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.method==="GET"));
  const refused=await auth("/api/market-observe",{});assert.equal(refused.status,405);assert.equal(calls.length,2);
 }finally{globalThis.fetch=savedFetch}
});
