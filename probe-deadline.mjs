// Sprite benchmark latency budget. Monotonic clock is injectable for tests.
// Never report an inference returned after its deadline as successful.
export const PROBE_BUDGET=Object.freeze({target_ms:10000,deadline_ms:13500,response_reserve_ms:500,identity_cap_ms:4000,visual_download_cap_ms:3500,file_download_cap_ms:5000});
export function makeProbeDeadline(now=()=>performance.now(),budget=PROBE_BUDGET){
 const {deadline_ms:deadline,response_reserve_ms:reserve}=budget;
 if(!Number.isSafeInteger(deadline)||!Number.isSafeInteger(reserve)||deadline<1||reserve<0||reserve>=deadline)throw Error("Invalid probe budget");
 const start=now();if(!Number.isFinite(start))throw Error("Invalid probe clock");
 let highWater=start;
 const elapsed=()=>{const t=now();if(!Number.isFinite(t))throw Error("Invalid probe clock");highWater=Math.max(highWater,t);return highWater-start;};
 const remaining=()=>Math.max(0,Math.floor(deadline-reserve-elapsed()));
 function allowance(cap=Infinity){
  if(cap!==Infinity&&(!Number.isFinite(cap)||cap<1))throw Error("Invalid stage cap");
  const n=Math.min(remaining(),cap);
  if(!Number.isFinite(n)||n<1)throw Error("Probe deadline exhausted");
  return Math.floor(n);
 }
 async function run(operation,cap=Infinity){
  if(typeof operation!=="function")throw Error("Invalid probe operation");
  const ms=allowance(cap),stageEnd=elapsed()+ms;
  const controller=new AbortController();let timer;
  try{
   const result=await Promise.race([
    Promise.resolve().then(()=>{if(elapsed()>=stageEnd)throw Error("Probe stage deadline exceeded");return operation(controller.signal);}),
    new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error("Probe stage deadline exceeded"));},ms);})
   ]);
   // Timers may execute late when the event loop is busy. Check the clock
   // after resolution as well, so a late result cannot win the race.
   if(elapsed()>=stageEnd||remaining()<1){controller.abort();throw Error("Probe stage deadline exceeded");}
   return result;
  }catch(error){controller.abort();throw error;}
  finally{clearTimeout(timer);}
 }
 return {elapsed,remaining,allowance,run};
}
