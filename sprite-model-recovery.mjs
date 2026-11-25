// Pure Sprite model orchestration. Callers reserve the existing allowance.
// No extra inference attempts, no tools or external actions.
const statuses=new Set(["completion_limit","filtered","unexpected_tool_call","reasoning_only","empty_output","incomplete_output","output_limit"]);
export function extractSpriteAnswer(out){
 const choice=out?.choices?.[0]??out?.result?.choices?.[0];
 const reason=choice?.finish_reason??out?.finish_reason??out?.result?.finish_reason;
 const fail=category=>{const e=Error("No verified final model response");e.category=category;throw e;};
 if(reason==="length"||reason==="max_tokens")return fail("completion_limit");
 if(reason==="content_filter")return fail("filtered");
 if(reason==="tool_calls"||reason==="function_call"||choice?.message?.tool_calls?.length||choice?.message?.function_call)return fail("unexpected_tool_call");
 if(reason!=null&&!["stop","end_turn","eos"].includes(reason))return fail("incomplete_output");
 const candidates=[choice?.message?.content,out?.response,out?.result?.response,out?.output];
 for(const v of candidates){
  const raw=typeof v==="string"?v:Array.isArray(v)?v.filter(x=>x?.type==="text"&&typeof x.text==="string").map(x=>x.text).join(""):"";
  const clean=raw.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi,"").trim();
  if(!clean||/<\/?think\b/i.test(clean))continue;
  if(clean.length>4000)return fail("output_limit");
  return clean;
 }
 return fail(choice?.message?.reasoning_content||choice?.message?.reasoning?"reasoning_only":"empty_output");
}
export async function runSpriteModelOnce(fn,{input,timeoutMs=40000,signal}={}){
 if(typeof fn!=="function"||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>40000)throw Error("Invalid model configuration");
 if(signal?.aborted)return {ok:false,status:"cancelled"};
 let timer,onAbort,closed=false;
 try{
  const stop=new Promise(resolve=>{
   onAbort=()=>{closed=true;resolve({ok:false,status:"cancelled"});};
   signal?.addEventListener("abort",onAbort,{once:true});
   if(signal?.aborted){onAbort();return;}
   timer=setTimeout(()=>{closed=true;resolve({ok:false,status:"timeout"});},timeoutMs);
  });
  const work=Promise.resolve().then(async()=>{
   if(closed||signal?.aborted)return {ok:false,status:"cancelled"};
   const value=await fn(input);
   if(closed||signal?.aborted)return {ok:false,status:"late_or_cancelled"};
   return typeof value==="string"&&value.trim()&&value.length<=4000?{ok:true,reply:value.trim()}:{ok:false,status:"empty_output"};
  }).catch(e=>({ok:false,status:statuses.has(e?.category)?e.category:"provider_error"}));
  return await Promise.race([stop,work]);
 }finally{closed=true;clearTimeout(timer);if(onAbort)signal?.removeEventListener("abort",onAbort);}
}
export async function runSpriteModelPair({gemma,flash,timeoutMs=40000,signal,now=Date.now}={}){
 if(typeof gemma!=="function"||typeof flash!=="function"||!Number.isInteger(timeoutMs)||timeoutMs<20||timeoutMs>40000)throw Error("Invalid model configuration");
 const start=now();
 const gemmaBudget=Math.max(10,Math.min(8000,Math.floor(timeoutMs/3)));
 const review=await runSpriteModelOnce(gemma,{timeoutMs:gemmaBudget,signal});
 const gemma_status=review.ok?"completed":review.status;
 if(signal?.aborted)return {ok:false,status:"cancelled",gemma_status};
 const remaining=Math.min(timeoutMs,Math.floor(timeoutMs-Math.max(0,now()-start)));
 const final=remaining>=10?await runSpriteModelOnce(flash,{input:review.ok?review.reply:null,timeoutMs:remaining,signal}):{ok:false,status:"deadline_exhausted"};
 const states={gemma_status,flash_status:final.ok?"completed":final.status};
 if(signal?.aborted)return {ok:false,status:"cancelled",...states};
 if(final.ok)return {ok:true,reply:final.reply,combined:review.ok,fallback:review.ok?null:"glm",...states};
 if(review.ok)return {ok:true,reply:review.reply,combined:false,fallback:"gemma",...states};
 return {ok:false,status:"both_unavailable",...states};
}
