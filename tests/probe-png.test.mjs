import test from "node:test";
import assert from "node:assert/strict";
import {deflateSync} from "node:zlib";
import {crc32,validateProbePng} from "../probe-png.mjs";
function chunk(type,data){
 const t=Buffer.from(type,"ascii"),body=Buffer.concat([t,Buffer.from(data)]);
 const out=Buffer.alloc(12+data.length);
 out.writeUInt32BE(data.length);body.copy(out,4);out.writeUInt32BE(crc32(body),8+data.length);return out;
}
function image(width=1,height=1){
 const h=Buffer.alloc(13);h.writeUInt32BE(width,0);h.writeUInt32BE(height,4);h[8]=8;h[9]=0;
 const data=deflateSync(Buffer.alloc(height<=32&&width<=32?height*(width+1):2));
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",h),chunk("IDAT",data),chunk("IEND",Buffer.alloc(0))]);
}
test("CRC32 standard reference vector",()=>assert.equal(crc32(Buffer.from("123456789")),0xcbf43926));
test("valid PNG fixtures",()=>{for(let w=1;w<=32;w++)for(let h=1;h<=32;h++){const r=validateProbePng(image(w,h));assert.equal(r.width,w);assert.equal(r.height,h);}});
test("every single-bit mutation of the small valid image fails structural validation",()=>{
 const original=image();for(let i=0;i<original.length;i++)for(let bit=0;bit<8;bit++){
  const bad=Buffer.from(original);bad[i]^=1<<bit;assert.throws(()=>validateProbePng(bad));
 }
});
test("all truncated prefixes and trailing bytes are rejected",()=>{
 const original=image();for(let i=0;i<original.length;i++)assert.throws(()=>validateProbePng(original.subarray(0,i)));
 assert.throws(()=>validateProbePng(Buffer.concat([original,Buffer.from([0])])));
});
test("dimension product limit and zero dimensions",()=>{
 for(const [w,h] of [[0,1],[1,0],[4097,4096],[4294967295,4294967295]])assert.throws(()=>validateProbePng(image(w,h)));
});
