import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {buildResearch} from "../research-delivery.mjs";
const input={countries:["USA","CAN","GBR"],indicator:"NY.GDP.PCAP.CD",year:2024};
const row=(country,value,patch={})=>({countryiso3code:country,indicator:{id:input.indicator},date:"2024",value,obs_status:"",...patch});
const payload=[{pages:1,lastupdated:"2026-01-01"},[row("CAN",200),row("USA",300),row("GBR",100)]];
const exactURL="https://api.worldbank.org/v2/country/USA;CAN;GBR/indicator/NY.GDP.PCAP.CD?date=2024&format=json&per_page=100&source=2";
test("research report matches independent arithmetic and exact source bytes",async()=>{
  const raw=JSON.stringify(payload);
  const report=await buildResearch(input,async(url,opts)=>{assert.equal(url,exactURL);assert.equal(opts.redirect,"manual");assert.deepEqual(opts.headers,{"Accept":"application/json"});return new Response(raw)});
  assert.equal(report.report.source.sha256,createHash("sha256").update(raw).digest("hex"));
  assert.equal(report.source_json,raw);
  assert.equal(report.report.comparison.highest.country,"USA");
  assert.equal(report.report.comparison.lowest.country,"GBR");
  assert.equal(report.report.comparison.spread,200);
  assert.equal(report.report.marketplace_submission,false);
  assert.equal(report.csv,"country,year,indicator,value\r\nUSA,2024,NY.GDP.PCAP.CD,300\r\nCAN,2024,NY.GDP.PCAP.CD,200\r\nGBR,2024,NY.GDP.PCAP.CD,100\r\n");
  assert.equal(report.csv_sha256,createHash("sha256").update(report.csv).digest("hex"));
});
test("research refuses arbitrary URLs, unsupported parameters, duplicate countries and invalid year before network",async()=>{
 for(const patch of [{url:"https://example.org"},{countries:["USA","USA"]},{countries:["USA","../CAN"]},{indicator:"../../x"},{year:9999}]){
  await assert.rejects(buildResearch({...input,...patch},async()=>assert.fail("Unexpected network")));
 }
});
test("missing source observations remain null rather than being fabricated",async()=>{
 const result=await buildResearch(input,async()=>Response.json([{pages:1},[row("USA",300),row("CAN",null)]]));
 assert.equal(result.report.comparison.available,1);
 assert.equal(result.report.comparison.spread,null);
 assert.equal(result.report.observations[1].value,null);
 assert.equal(result.report.observations[2].observation_status,"missing");
});
test("research rejects wrong indicator, duplicate observations, wrong year and pagination",async()=>{
 for(const bad of [[{pages:2},payload[1]],[{pages:1},[...payload[1],row("USA",1)]],[{pages:1},[row("USA",1,{date:"2023"})]],[{pages:1},[row("USA",1,{indicator:{id:"WRONG"}})]],[{pages:1},[row("USA","300")]]]){
  await assert.rejects(buildResearch(input,async()=>Response.json(bad)));
 }
});
test("research refuses redirects and oversized sources",async()=>{
 await assert.rejects(buildResearch(input,async()=>new Response(null,{status:302,headers:{Location:"https://example.org"}})));
 await assert.rejects(buildResearch(input,async()=>new Response("x".repeat(131073))));
});
