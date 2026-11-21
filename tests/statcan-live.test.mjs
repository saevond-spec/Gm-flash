import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {fetchCanadaPopulation} from "../statcan-live.mjs";
const obs={refPer:"2024-07-01",value:41162593,scalarFactorCode:0,releaseTime:"2026-09-23T08:30"};
const fixture=[{status:"SUCCESS",object:{productId:17100009,vectorId:1,coordinate:"1.0.0.0.0.0.0.0.0.0",vectorDataPoint:[obs]}}];
test("live-secondary parser validates national vector and exact date, and retains provenance",async()=>{
 const raw=JSON.stringify(fixture);
 const r=await fetchCanadaPopulation(2024,async(url,opts)=>{assert.equal(url,"https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods");assert.equal(opts.redirect,"manual");assert.equal(JSON.parse(opts.body)[0].vectorId,1);return new Response(raw)});
 assert.equal(r.value,41162593);assert.equal(r.reference_date,"2024-07-01");assert.equal(r.release_time,obs.releaseTime);assert.equal(r.sha256,createHash("sha256").update(raw).digest("hex"));assert.equal(r.source_independence_verified,false);
});
test("secondary source rejects mismatched series, date, units and duplicated observations",async()=>{
 for(const patch of [{vectorId:2},{productId:123},{vectorDataPoint:[{...obs,refPer:"2024-10-01"}]},{vectorDataPoint:[{...obs,scalarFactorCode:3}]},{vectorDataPoint:[obs,obs]},{vectorDataPoint:[{...obs,value:null}]}]){
 const f=[{...fixture[0],object:{...fixture[0].object,...patch}}];
 await assert.rejects(fetchCanadaPopulation(2024,async()=>Response.json(f)));
 }
 await assert.rejects(fetchCanadaPopulation(2024,async()=>new Response(null,{status:302})));
});
