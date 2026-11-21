import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker from "../worker.mjs";

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
