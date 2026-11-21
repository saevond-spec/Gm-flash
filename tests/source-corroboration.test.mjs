import test from "node:test";
import assert from "node:assert/strict";
import {corroboratePopulation,REFERENCE_2024} from "../source-corroboration.mjs";
const make=(observations,indicator="SP.POP.TOTL")=>({source:{indicator},observations});
test("corroboration distinguishes same-date agreement, disagreement, and mismatched reference dates",()=>{
 const r=corroboratePopulation(make([{country:"USA",year:2024,value:340110988},{country:"CAN",year:2024,value:42000000},{country:"JPN",year:2024,value:123802000}]));
 assert.deepEqual(r.results.map(x=>x.status),["within_review_threshold","needs_review","different_reference_date"]);
 assert.equal(r.results[0].delta_persons,0);
 assert.equal(r.results[1].delta_persons,837407);
 assert.equal(r.results[1].absolute_relative_difference,837407/41162593);
 assert.equal(r.source_independence_verified,false);
 assert.equal(r.reference_live_fetched,false);
});
test("missing, unsupported, and invalid observations remain unavailable",()=>{
 const r=corroboratePopulation(make([{country:"USA",year:2025,value:1},{country:"CAN",year:2024,value:null},{country:"GBR",year:2024,value:1},{country:"JPN",year:2024,value:0}]));
 assert.ok(r.results.every(x=>x.status==="unavailable"));
 assert.equal(corroboratePopulation(make([],"NY.GDP.PCAP.CD")),null);
});
test("national references preserve publisher and dates",()=>{
 assert.equal(REFERENCE_2024.CAN.reference_date,"2024-07-01");
 assert.equal(REFERENCE_2024.JPN.reference_date,"2024-10-01");
 assert.equal(REFERENCE_2024.USA.vintage,"V2024");
});
