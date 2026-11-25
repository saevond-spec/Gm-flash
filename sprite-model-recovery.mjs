// Pure inference orchestration for authenticated Sprite chat. The caller reserves
// existing model allowance before invoking. At most one attempt per model.
export async function runSpriteModelPair({gemma,flash,timeoutMs=40000,signal}={}){
 if(typeof gemma!=="function"||typeof flash!=="function"||!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>40000)throw Error("Invalid model configuration");
 const invoke=async(fn,input)=>{
  if(signal?.aborted)return {ok:false,status:"cancelled"};
  let timer,onAbort;
  try{
   const stop=new Promise(resolve=>{onAbort=()=>resolve({ok:false,status:"cancelled"});signal?.addEventListener("abort",onAbort,{once:true});if(signal?.aborted)onAbort();timer=setTimeout(()=>resolve({ok:false,status:"timeout"}),timeoutMs);});
   const work=Promise.resolve().then(()=>signal?.aborted?null:fn(input)).then(value=>typeof value==="string"&&value.trim()?{ok:true,reply:value.trim().slice(0,4000)}:{ok:false,status:"empty"}).catch(()=>({ok:false,status:"provider_error"}));
   return await Promise.race([stop,work]);
  }finally{clearTimeout(timer);signal?.removeEventListener("abort",onAbort);}
 };
 const review=await invoke(gemma);
 if(signal?.aborted)return {ok:false,status:"cancelled",gemma_status:review.ok?"completed":review.status};
 const final=await invoke(flash,review.ok?review.reply:null);
 if(signal?.aborted)return {ok:false,status:"cancelled",gemma_status:review.ok?"completed":review.status,flash_status:final.ok?"completed":final.status};
 const states={gemma_status:review.ok?"completed":review.status,flash_status:final.ok?"completed":final.status};
 if(final.ok)return {ok:true,reply:final.reply,combined:review.ok,fallback:review.ok?null:"glm",...states};
 if(review.ok)return {ok:true,reply:review.reply,combined:false,fallback:"gemma",...states};
 return {ok:false,status:"both_unavailable",...states};
}
