import test from "node:test";
import assert from "node:assert/strict";
import worker,{reasoningTasks,solveReasoningTask,independentReasoningCheck,gradeReasoningOutput} from "../worker.mjs";
import {createHmac} from "node:crypto";

test("independent mathematical solvers agree across 1000 generated seeds",()=>{
 for(let seed=1;seed<=1000;seed++)for(const task of reasoningTasks(seed)){
  const answer=solveReasoningTask(task);
  assert.ok(Number.isSafeInteger(answer));
  assert.equal(answer,independentReasoningCheck(task),`seed ${seed}, ${task.id}`);
 }
});
test("invalid and incomplete model responses never receive full credit",()=>{
 const a={knapsack:12,shortest_path:5,congruence:3};
 for(const response of ["invalid","{}",'{"knapsack":12,"shortest_path":5,"congruence":"3"}','{"knapsack":12,"shortest_path":5,"congruence":3,"extra":1}']){
  assert.ok(gradeReasoningOutput({response},a).correct<3);
 }
 assert.equal(gradeReasoningOutput({response:JSON.stringify(a)},a).correct,3);
});
const secret="fictional-test-secret-not-for-production-123456789";
const url="https://clawhunt.store/api/v1/probe-files/test-image-v1.png";
function request(){
 const body=JSON.stringify({event_type:"capability_probe",probe_type:"visual_observation",probe_id:"synthetic",payload:{image_url:url}});
 const t=String(Math.floor(Date.now()/1000));
 const sig=createHmac("sha256",secret).update(t+"."+body).digest("hex");
 return new Request("https://example.invalid/cph-webhook",{method:"POST",headers:{"X-CPH-Probe-Timestamp":t,"X-CPH-Probe-Signature":"sha256="+sig},body});
}
function header(width,height){
 const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
 const v=new DataView(bytes.buffer);v.setUint32(16,width);v.setUint32(20,height);return bytes;
}
test("vision rejects oversized streamed data and invalid dimensions before inference",async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
  for(const bytes of [new Uint8Array(262145),header(0,1),header(65536,65536)]){
   globalThis.fetch=async()=>new Response(bytes);
   const res=await worker.fetch(request(),{CPH_WEBHOOK_SECRET:secret,AI:{run:async()=>{calls++;throw Error("unexpected inference");}}});
   assert.equal((await res.json()).status,"error");
  }
  assert.equal(calls,0);
 }finally{globalThis.fetch=original;}
});
test("visual prompt preserves exact text, regional coverage, and untrusted image handling",async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(header(10,10));
  const res=await worker.fetch(request(),{CPH_WEBHOOK_SECRET:secret,AI:{run:async(model,params)=>{
   const prompt=params.messages[0].content[0].text;
   assert.match(prompt,/each region/);assert.match(prompt,/exactly/);assert.match(prompt,/untrusted data/);
   assert.ok(params.max_tokens>=640);
   return {response:"Synthetic visual response"};
  }}});
  const body=await res.json();assert.equal(body.status,"success");assert.equal(body.result.description,"Synthetic visual response");
 }finally{globalThis.fetch=original;}
});
