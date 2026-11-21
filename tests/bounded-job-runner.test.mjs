import test from "node:test";
import assert from "node:assert/strict";
import {runBoundedJob} from "../bounded-job-runner.mjs";
test("bounded runner: 4096 synthetic exact arithmetic cases",()=>{
 let seed=0xa4b914d3;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed};
 for(let i=1;i<=4096;i++){
  const a=(next()%20001)-10000,b=(next()%20001)-10000,c=(next()%101)-50;
  const r=runBoundedJob({job_id:String(i),instructions:[["push",a],["push",b],["add"],["push",c],["multiply"]]});
  assert.equal(r.ok,true);
  assert.equal(BigInt(r.value),(BigInt(a)+BigInt(b))*BigInt(c));
 }
});
test("bounded runner: 512 interleaved job pairs leave no stack state",()=>{
 for(let i=1;i<=512;i++){
  const a=runBoundedJob({job_id:"1",instructions:[["push",i]]}),b=runBoundedJob({job_id:"2",instructions:[["add"]]});
  assert.equal(a.value,i);assert.equal(b.ok,false);
 }
});
test("bounded runner: 512 forbidden opcodes rejected",()=>{
 for(const op of ["fetch","connect","socket","dns","open","read_file","write_file","eval","import","env","spawn","loop","jump","return","__proto__","constructor"]){
  for(let i=0;i<32;i++)assert.equal(runBoundedJob({job_id:"3",instructions:[["push",i],["push",i+1],[op]]}).ok,false);
 }
});
test("bounded runner: 10 malformed inputs and 5 resource boundary cases",()=>{
 for(const j of [null,[],{}, {job_id:"1",instructions:[],customer:"fictional"},{job_id:"01",instructions:[["push",1]]},{job_id:"1",instructions:[["push","1"]]},{job_id:"1",instructions:[["push",1.1]]},{job_id:"1",instructions:[["push",NaN]]},{job_id:"1",instructions:[["push",Infinity]]},{job_id:"1",instructions:[["push",1],["push",2]]}])assert.equal(runBoundedJob(j).ok,false);
 for(const instructions of [Array.from({length:65},()=>["push",1]),Array.from({length:33},()=>["push",1]),[["push",1000000000],["push",1],["add"]],[["push",-1000000000],["push",1],["subtract"]],[["push",1000000000],["push",1000000000],["multiply"]]])assert.equal(runBoundedJob({job_id:"1",instructions}).ok,false);
});
