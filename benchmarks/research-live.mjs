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
 console.log("LIVE_RESEARCH_RESULT",JSON.stringify({pass:true,source:data.report.source,observations:data.report.observations,comparison:data.report.comparison,csv_sha256:data.csv_sha256,ms:data.retrieval_ms,independent_source_corroboration:false,marketplace_submission:false}));
}catch(e){console.log("LIVE_RESEARCH_RESULT",JSON.stringify({pass:false,error:String(e.message).slice(0,250)}));}
