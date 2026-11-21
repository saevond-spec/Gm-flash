import {buildResearch} from "../research-delivery.mjs";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
const request={countries:["USA","CAN","JPN"],indicator:"SP.POP.TOTL",year:2024};
try{
 const data=await buildResearch(request);
 const raw=JSON.parse(data.source_json);
 const direct=new Map(raw[1].map(x=>[x.countryiso3code,x.value]));
 assert.equal(data.report.comparison.available,3);
 for(const row of data.report.observations){assert.equal(row.value,direct.get(row.country));assert.ok(row.value>0)}
 const values=[...direct.values()].sort((a,b)=>b-a);
 assert.equal(data.report.comparison.spread,values[0]-values.at(-1));
 assert.equal(data.report.source.sha256,createHash("sha256").update(data.source_json).digest("hex"));
 assert.equal(data.csv_sha256,createHash("sha256").update(data.csv).digest("hex"));
 const secondary=data.report.live_secondary;
 if(secondary?.status==="retrieved"){
  assert.equal(secondary.sha256,createHash("sha256").update(secondary.source_json).digest("hex"));
  assert.equal(secondary.delta_persons,direct.get("CAN")-secondary.value);
  assert.equal(secondary.absolute_relative_difference,Math.abs(secondary.delta_persons)/secondary.value);
  console.log("LIVE_SECONDARY_RESULT",JSON.stringify({pass:true,publisher:secondary.publisher,value:secondary.value,reference_date:secondary.reference_date,release_time:secondary.release_time,sha256:secondary.sha256,delta_persons:secondary.delta_persons,absolute_relative_difference:secondary.absolute_relative_difference,source_independence_verified:false}));
 }else console.log("LIVE_SECONDARY_RESULT",JSON.stringify({pass:false,status:secondary?.status??"not_run",reason:secondary?.reason??null}));
 console.log("LIVE_RESEARCH_RESULT",JSON.stringify({pass:true,source:data.report.source,observations:data.report.observations,comparison:data.report.comparison,csv_sha256:data.csv_sha256,ms:data.retrieval_ms,independent_source_corroboration:false,marketplace_submission:false}));
}catch(e){console.log("LIVE_RESEARCH_RESULT",JSON.stringify({pass:false,error:String(e.message).slice(0,250)}));}
