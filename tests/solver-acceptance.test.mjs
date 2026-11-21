import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {reconcile,prepareBidPlan} from "../bid-solve.mjs";
import {buildDataDelivery} from "../data-delivery.mjs";
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x;}}
test("independent exact-integer oracle: 1,024 reconciliation cases",()=>{
 const rand=rng(92037);
 for(let i=0;i<1024;i++){
  const entries=Array.from({length:1+rand()%500},()=>Number(rand()%200000001)-100000000);
  const total=entries.reduce((a,b)=>a+BigInt(b),0n);
  const delta=BigInt(i%2===0?0:1+rand()%10000);
  const declared=total+delta;
  const result=reconcile(entries,Number(declared));
  assert.equal(BigInt(result.total_cents),total);
  assert.equal(BigInt(result.difference_cents),-delta);
  assert.equal(result.matched,delta===0n);
  assert.equal(result.entries,entries.length);
 }
});
test("exact source duplicate semantics preserve distinct scalar types and escaped values",async()=>{
 const values=[1,"1",true,"true",null,"","=x","'=x",1,null,"=x"];
 const output=await buildDataDelivery({source_kind:"fictional",confirm_no_customer_data:true,columns:["value"],rows:values.map(value=>({value}))});
 assert.equal(output.manifest.rows_in,11);
 assert.equal(output.manifest.rows_out,8);
 assert.equal(output.manifest.duplicates_removed,3);
 assert.equal(output.manifest.csv_type_information_preserved,false);
 assert.equal(output.manifest.sha256,createHash("sha256").update(output.csv).digest("hex"));
});
test("marketplace-scale fictional deliverable: independently derived 500-row acceptance checks",async()=>{
 const rand=rng(17921),unique=[];
 for(let i=0;i<250;i++)unique.push({item:"Item-"+i,units:rand()%1000,amount_cents:rand()%20000-10000});
 const rows=[...unique,...unique].reverse();
 const result=await buildDataDelivery({source_kind:"fictional",confirm_no_customer_data:true,columns:["item","units","amount_cents"],rows});
 const expected='"item","units","amount_cents"\r\n'+unique.slice().reverse().map(r=>'"'+r.item+'","'+r.units+'","'+r.amount_cents+'"').join("\r\n")+"\r\n";
 assert.equal(result.csv,expected);
 assert.equal(result.manifest.rows_out,250);
 assert.equal(result.manifest.duplicates_removed,250);
 assert.equal(result.manifest.byte_size,Buffer.byteLength(expected));
 assert.equal(result.manifest.sha256,createHash("sha256").update(expected).digest("hex"));
 const entries=unique.map(r=>r.amount_cents);
 const independentTotal=entries.reduce((a,b)=>a+BigInt(b),0n);
 assert.equal(reconcile(entries,Number(independentTotal)).matched,true);
});
