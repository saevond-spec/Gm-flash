import {runSpriteModelPair} from "./sprite-model-recovery.mjs";
// Shared inference engine for streaming chat. No additional model calls.
// Emission and telemetry contain no raw prompts or private reasoning.
export async function runSpriteStream({gemma,flash,emit,signal,timeoutMs=40000,now=Date.now}){
 const start=now();let flashStart=null;
 const send=x=>{if(!signal?.aborted)emit(x);};
 send({stage:"Gemma 4 analyzing"});
 const result=await runSpriteModelPair({
  gemma,
  flash:review=>{
   flashStart=now();
   if(review)send({preview:review,model:"Gemma 4",provisional:true});
   send({stage:review?"Gemma complete; GLM Flash composing":"GLM Flash composing independently"});
   return flash(review);
  },
  signal,timeoutMs,now
 });
 const end=now();
 if(!signal?.aborted){
  if(result.ok)send({reply:result.reply,model:result.combined?"Sprite · Gemma 4 + GLM Flash":result.fallback==="gemma"?"Sprite · Gemma 4 only":"Sprite · GLM Flash only",combined:result.combined,fallback:result.fallback,gemma_status:result.gemma_status,flash_status:result.flash_status,external_action:false});
  else send({error:"No completed model answer. No automatic retry.",gemma_status:result.gemma_status??null,flash_status:result.flash_status??null});
 }
 const metrics=[{stage:"gemma",outcome:result.gemma_status??"cancelled",from:start,to:flashStart??end}];
 if(flashStart!==null)metrics.push({stage:"glm",outcome:result.flash_status??"cancelled",from:flashStart,to:end});
 metrics.push({stage:"combined",outcome:result.ok?(result.combined?"completed":"partial"):result.status??"error",from:start,to:end});
 return {metrics};
}
