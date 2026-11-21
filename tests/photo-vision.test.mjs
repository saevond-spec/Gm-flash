import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {analyzePublicPhoto} from "../photo-vision.mjs";
const input={fixture:"kitchen",question:"Which objects are visible in the photograph?"};
const jpeg=Uint8Array.from([255,216,255,224,0,16,74,70,73,70,0,1,1,0,0,1,255,217]);
test("photo pipeline passes exact downloaded bytes and question, not URL, to inference",async()=>{
 let count=0;
 const result=await analyzePublicPhoto(input,{run:async(model,args)=>{
   assert.equal(model,"@cf/google/gemma-4-26b-a4b-it");
   const c=args.messages[1].content;
   assert.equal(c[0].text,input.question);
   assert.equal(c[1].image_url.url,"data:image/jpeg;base64,"+Buffer.from(jpeg).toString("base64"));
   count++;return {choices:[{message:{content:"Fixture model response"}}]};
 }},async(url,opts)=>{assert.equal(url,"https://images.cocodataset.org/val2017/000000397133.jpg");assert.equal(opts.redirect,"manual");return new Response(jpeg)});
 assert.equal(count,1);
 assert.equal(result.image_sha256,createHash("sha256").update(jpeg).digest("hex"));
 assert.equal(result.independently_graded,false);
});
test("photo pipeline rejects arbitrary URLs, malformed photos, redirects and oversized images",async()=>{
 const ai={run:async()=>assert.fail("Unexpected inference")};
 await assert.rejects(analyzePublicPhoto({...input,fixture:"https://example.org"},ai,async()=>assert.fail("Unexpected fetch")));
 await assert.rejects(analyzePublicPhoto({...input,url:"https://example.org"},ai,async()=>assert.fail("Unexpected fetch")));
 await assert.rejects(analyzePublicPhoto(input,ai,async()=>new Response("not jpeg")));
 await assert.rejects(analyzePublicPhoto(input,ai,async()=>new Response(null,{status:302})));
 await assert.rejects(analyzePublicPhoto(input,ai,async()=>new Response(new Uint8Array(1048577))));
});
