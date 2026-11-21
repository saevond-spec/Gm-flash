import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
// Fixed fictional modules only. Node test harness, not a production sandbox.
const normal=[0,97,115,109,1,0,0,0,1,5,1,96,0,1,127,3,2,1,0,7,7,1,3,114,117,110,0,0,10,6,1,4,0,65,42,11];
const runaway=[0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,7,7,1,3,114,117,110,0,0,10,9,1,7,0,3,64,12,0,11,11];
async function runFixture(bytes,limitMs=100){
  const w=new Worker("const {parentPort,workerData}=require('node:worker_threads');\n    const module=new WebAssembly.Module(Uint8Array.from(workerData));\n    if(WebAssembly.Module.imports(module).length)throw Error('Host imports denied');\n    const instance=new WebAssembly.Instance(module,{});\n    parentPort.postMessage({ready:true});\n    parentPort.once('message',()=>parentPort.postMessage({result:instance.exports.run()}));",{eval:true,workerData:bytes,env:{},resourceLimits:{maxOldGenerationSizeMb:16,maxYoungGenerationSizeMb:4,stackSizeMb:2}});
  let timer;
  try{return await new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('Fixture startup deadline')),3000);
    w.on('error',reject);
    w.on('exit',code=>reject(Error('Unexpected worker exit '+code)));
    w.on('message',msg=>{if(msg.ready){clearTimeout(timer);timer=setTimeout(()=>resolve({timed_out:true}),limitMs);w.postMessage('run');}else{resolve({timed_out:false,result:msg.result});}});
  });}finally{clearTimeout(timer);await w.terminate();}
}
test('normal fixed guest returns expected result',async()=>{assert.deepEqual(await runFixture(normal,1000),{timed_out:false,result:42});});
test('supervisor terminates a deliberately infinite guest at deadline',async()=>{assert.deepEqual(await runFixture(runaway),{timed_out:true});});
test('repeated runaway guest termination leaves supervisor available',async()=>{for(let i=0;i<3;i++)assert.equal((await runFixture(runaway)).timed_out,true);assert.equal((await runFixture(normal,1000)).result,42);});
