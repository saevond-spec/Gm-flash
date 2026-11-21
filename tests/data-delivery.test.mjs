import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {buildDataDelivery} from "../data-delivery.mjs";
const input={source_kind:"fictional",confirm_no_customer_data:true,columns:["item","price","active"],rows:[{item:"A, B",price:3,active:true},{item:'A "quote"',price:4,active:false},{item:"A, B",price:3,active:true}]};
test("produces exact CSV and deterministic integrity manifest",async()=>{
 const result=await buildDataDelivery(input);
 const expected='"item","price","active"\r\n"A, B","3","true"\r\n"A ""quote""","4","false"\r\n';
 assert.equal(result.csv,expected);
 assert.equal(result.manifest.rows_out,2);
 assert.equal(result.manifest.duplicates_removed,1);
 assert.equal(result.manifest.sha256,createHash("sha256").update(expected).digest("hex"));
 assert.equal(result.manifest.byte_size,Buffer.byteLength(expected));
});
test("escapes spreadsheet formulas including leading whitespace",async()=>{
 const values=["=1+1","+SUM(A1)","-2+5","@SUM(A1)"," \t=1","\tmalicious","plain"];
 const x=await buildDataDelivery({...input,columns:["item"],rows:values.map(item=>({item}))});
 for(const v of values.slice(0,-1))assert.ok(x.csv.includes('"'+ "'"+v+'"'));
 assert.ok(x.csv.includes('"plain"'));
});
test("rejects private categories and absent operator declaration",async()=>{
 for(const patch of [{source_kind:"customer"},{confirm_no_customer_data:false},{columns:["api_key"],rows:[{api_key:"fake"}]},{columns:["email"],rows:[{email:"fake"}]}]){
 await assert.rejects(buildDataDelivery({...input,...patch}));
 }
});
test("rejects malformed schemas, missing cells and complex values",async()=>{
 for(const patch of [{columns:["item","item"]},{rows:[{item:"a"}]},{rows:[{item:"a",price:{x:1},active:true}]},{rows:[{...input.rows[0],extra:"x"}]},{rows:Array(501).fill(input.rows[0])}]){
 await assert.rejects(buildDataDelivery({...input,...patch}));
 }
});
test("unseen reproducible dataset: stable independent expected counts and hash",async()=>{
 const rows=Array.from({length:300},(_,i)=>({item:"item_"+(i%37),price:(i%37)*11,active:(i%37)%2===0}));
 const result=await buildDataDelivery({...input,rows});
 const expected='"item","price","active"\r\n'+Array.from({length:37},(_,i)=>'"item_'+i+'","'+(i*11)+'","'+(i%2===0)+'"\r\n').join("");
 assert.equal(result.manifest.rows_out,37);assert.equal(result.manifest.duplicates_removed,263);
 assert.equal(result.csv,expected);
 assert.equal(result.manifest.sha256,createHash("sha256").update(expected).digest("hex"));
});
