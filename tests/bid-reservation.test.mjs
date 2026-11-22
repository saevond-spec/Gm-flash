import test from "node:test";
import assert from "node:assert/strict";
import {submitWithReservation} from "../bid-reservation.mjs";
function fixture(failUpdate=false){
 const rows=new Map();
 return {rows,prepare(sql){return {bind(id,amount){return {
 async first(){if(rows.has(id))return null;rows.set(id,{amount,state:"reserved"});return {problem_id:id}},
 async run(){if(failUpdate)throw Error("fixture outage");rows.get(id).state="uncertain";return {success:true}}
 }}}}}
}
test("64 concurrent duplicate attempts allow exactly one transport invocation",async()=>{
 const db=fixture();let sent=0;
 const out=await Promise.all(Array.from({length:64},()=>submitWithReservation(db,"123",500,async()=>{sent++;return {ok:true,status:200}})));
 assert.equal(sent,1);assert.equal(out.filter(x=>x.attempted).length,1);assert.equal(out.filter(x=>x.http_status===409).length,63);
 assert.equal(db.rows.get("123").state,"uncertain");
});
test("transport exception and ledger update failure do not reopen a reservation",async()=>{
 const db=fixture(true);let sent=0;
 const send=async()=>{sent++;throw Error("timeout")};
 const first=await submitWithReservation(db,"123",500,send);
 assert.equal(first.state,"uncertain");assert.equal(db.rows.get("123").state,"reserved");
 const retry=await submitWithReservation(db,"123",500,send);
 assert.equal(retry.attempted,false);assert.equal(sent,1);
});
test("missing or failing ledger prohibits transport; bounds are exact",async()=>{
 let sent=0;const send=async()=>{sent++};
 for(const db of [null,{prepare(){throw Error("unavailable")}}]){
  assert.equal((await submitWithReservation(db,"123",500,send)).attempted,false);
 }
 for(const amount of [499,10000001,NaN,500.1]){
  assert.equal((await submitWithReservation(fixture(),"123",amount,send)).attempted,false);
 }
 assert.equal(sent,0);
});

test("distinct low-price jobs can reserve independently while preserving per-task deduplication",async()=>{
 const db=fixture();let sent=0;const send=async()=>{sent++;return {ok:true,status:200}};
 const result=await Promise.all([submitWithReservation(db,"111",500,send),submitWithReservation(db,"112",650,send),submitWithReservation(db,"111",500,send)]);
 assert.equal(sent,2);assert.equal(result.filter(x=>x.attempted).length,2);assert.equal(db.rows.size,2);
});
