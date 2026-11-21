import test from 'node:test';
import assert from 'node:assert/strict';
// Fixed synthetic binary fixture, not uploaded or executable customer content.
const bytes=new Uint8Array([0,97,115,109,1,0,0,0,1,9,2,96,1,127,0,96,0,1,127,3,3,2,0,1,5,4,1,1,1,1,7,22,3,3,115,101,116,0,0,3,103,101,116,0,1,6,109,101,109,111,114,121,2,0,10,19,2,9,0,65,0,32,0,54,2,0,11,7,0,65,0,40,2,0,11]);
const m=new WebAssembly.Module(bytes);
const instantiate=()=>new WebAssembly.Instance(m,Object.create(null)).exports;
test('fixed guest has zero host imports and independent memories',()=>{
 assert.deepEqual(WebAssembly.Module.imports(m),[]);const a=instantiate(),b=instantiate();a.set(1234);b.set(5678);assert.equal(a.get(),1234);assert.equal(b.get(),5678);assert.notEqual(a.memory.buffer,b.memory.buffer);assert.equal(instantiate().get(),0);
});
test('fixed guest memory is bounded at 64 KiB',()=>{const a=instantiate();assert.equal(a.memory.buffer.byteLength,65536);assert.throws(()=>a.memory.grow(1),RangeError);});
test('a fresh instance does not inherit fictional data from 256 previous instances',()=>{for(let i=1;i<=256;i++){const a=instantiate();assert.equal(a.get(),0);a.set(i);assert.equal(a.get(),i);}});
const imp=new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,2,13,1,3,101,110,118,5,102,101,116,99,104,0,0]);
test('guest requesting a host capability cannot instantiate without it',()=>{const m=new WebAssembly.Module(imp);assert.deepEqual(WebAssembly.Module.imports(m),[{module:'env',name:'fetch',kind:'function'}]);assert.throws(()=>new WebAssembly.Instance(m,{env:Object.create(null)}),WebAssembly.LinkError);});
