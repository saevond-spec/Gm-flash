import test from "node:test";
import assert from "node:assert/strict";
import {makeProbeDeadline,PROBE_BUDGET} from "../probe-deadline.mjs";
test("shared budget retains response reserve",()=>{
 let now=0;const d=makeProbeDeadline(()=>now);
 assert.equal(d.allowance(PROBE_BUDGET.identity_cap_ms),4000);
 now=4000;assert.equal(d.allowance(PROBE_BUDGET.visual_download_cap_ms),3500);
 now=7500;assert.equal(d.remaining(),5500);
 now=12999;assert.equal(d.remaining(),1);
 now=13000;assert.throws(()=>d.allowance(),/exhausted/);
});
test("every simulated starting point stays within hard deadline",()=>{
 let now=0;const d=makeProbeDeadline(()=>now);
 for(now=0;now<13000;now++){
  assert.ok(now+d.allowance()+PROBE_BUDGET.response_reserve_ms<=PROBE_BUDGET.deadline_ms);
  assert.ok(d.allowance(PROBE_BUDGET.file_download_cap_ms)<=5000);
 }
});
test("stage completes normally",async()=>{
 const d=makeProbeDeadline();assert.equal(await d.run(async signal=>{assert.equal(signal.aborted,false);return 42;},100),42);
});
test("late inference cannot be reported as success",async()=>{
 const d=makeProbeDeadline();let signal;
 await assert.rejects(d.run(s=>{signal=s;return new Promise(resolve=>setTimeout(()=>resolve("late"),30));},5),/deadline exceeded/);
 assert.equal(signal.aborted,true);
});
test("exhausted deadline does not invoke operation",async()=>{
 let now=0;const d=makeProbeDeadline(()=>now);now=13000;
 let called=false;await assert.rejects(d.run(()=>{called=true;}),/exhausted/);assert.equal(called,false);
});
