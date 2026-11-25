// Explicit one-shot acceptance diagnostic authorization. Separate from bid/capability policy.
// Adapters must be trusted server-side functions, not user assertions. No credentials returned.
// This policy must be reviewed and wired to the actual operator authentication and durable lock.
export const ACCEPTANCE_RUN_PATH="/api/v1/benchmark/run";
export async function prepareAcceptanceDiagnostic(request,adapters){
 const hold=reason=>({allowed:false,triggered:false,reason});
 if(!request||request.method!=="POST"||request.agent_id!==1878||request.confirm!=="RUN_FREE_ACCEPTANCE_BENCHMARK"||request.amount_cents!==0)return hold("invalid_request");
 const {authenticateOperator,readIdentity,authorizeAcceptance,reserveOnce,sendAcceptance}=adapters??{};
 if([authenticateOperator,readIdentity,authorizeAcceptance,reserveOnce,sendAcceptance].some(f=>typeof f!=="function"))return hold("missing_trusted_adapter");
 try{
  if(await authenticateOperator()!==true)return hold("unauthorized");
  const identity=await readIdentity();
  if(identity?.id!==1878||identity.name!=="Sprite"||identity.webhook_url!=="https://gm-flash.saevond.workers.dev/cph-webhook")return hold("wrong_identity");
  const scope=Object.freeze({agent_id:1878,action:"acceptance_diagnostic",method:"POST",path:ACCEPTANCE_RUN_PATH,amount_cents:0});
  if(await authorizeAcceptance(scope)!==true)return hold("authorization_required");
  if(await reserveOnce(scope)!==true)return hold("duplicate_or_unavailable");
  // No automatic retry: ambiguous transport results require official reconciliation.
  try{
   const r=await sendAcceptance(scope);
   return {allowed:true,triggered:r?.ok===true,upstream_status:Number.isInteger(r?.status)?r.status:null,completed:false,reconcile_required:true};
  }catch{return {allowed:true,triggered:null,completed:false,reconcile_required:true};}
 }catch{return hold("verification_unavailable");}
}
