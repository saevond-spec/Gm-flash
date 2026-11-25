// Sprite benchmark latency budget. Uses an injected monotonic clock for tests.
// Never substitute a cached answer or report a timed-out inference as success.
export const PROBE_BUDGET=Object.freeze({target_ms:10000,deadline_ms:13500,response_reserve_ms:500,identity_cap_ms:4000,visual_download_cap_ms:3500,file_download_cap_ms:5000});
export function makeProbeDeadline(now=()=>performance.now(),budget=PROBE_BUDGET){
 const start=now();
 const elapsed=()=>Math.max(0,now()-start);
 const remaining=()=>Math.max(0,Math.floor(budget.deadline_ms-budget.response_reserve_ms-elapsed()));
 function allowance(cap=Infinity){
  const n=Math.min(remaining(),cap);
  if(!Number.isFinite(n)||n<1)throw Error("Probe deadline exhausted");
  return Math.floor(n);
 }
 async function run(operation,cap=Infinity){
  const ms=allowance(cap);const controller=new AbortController();let timer;
  try{
   return await Promise.race([
    Promise.resolve().then(()=>operation(controller.signal)),
    new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error("Probe stage deadline exceeded"));},ms);})
   ]);
  }finally{clearTimeout(timer);}
 }
 return {elapsed,remaining,allowance,run};
}
