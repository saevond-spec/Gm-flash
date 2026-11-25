// Sprite-only benchmark request contract. Not an authorization issuer.
// Integration must use trusted server-side adapters for identity, council verification,
// atomic cooldown reservation, and the fixed ClawHunt transport. Never use client
// supplied approval booleans, and never fall back to an unrestricted request function.
export const BENCHMARK_SCOPE=Object.freeze({agent_id:1878,action:"benchmark_run",amount_cents:0,method:"POST",path:"/api/v1/capability-probe/run"});
const HOOK="https://gm-flash.saevond.workers.dev/cph-webhook";
const held=reason=>({state:"held",reason,attempted:false,confirmed:false});
export async function runApprovedBenchmark(adapters){
 if(!adapters||!["authenticateOperator","readIdentity","verifyCouncilApproval","reserveProbe","sendBenchmark"].every(k=>typeof adapters[k]==="function"))return held("missing_trusted_adapter");
 let started=false;
 try{
  if(await adapters.authenticateOperator()!==true)return held("operator_not_authenticated");
  const identity=await adapters.readIdentity();
  if(Number(identity?.id??identity?.agent_id)!==1878||identity?.name!=="Sprite"||identity?.webhook_url!==HOOK||identity?.admission_status!=="approved")return held("identity_or_webhook_mismatch");
  // Adapter must verify genuine scoped approval with trusted keys and freshness.
  // No request-body data or self-attestation is accepted by this module.
  if(await adapters.verifyCouncilApproval(BENCHMARK_SCOPE)!==true)return held("council_approval_unverified");
  // Reserve atomically and enforce at least the platform's 180-second cooldown.
  // A failed/uncertain transport must retain the reservation: never blindly retry.
  if(await adapters.reserveProbe(BENCHMARK_SCOPE,180)!==true)return held("cooldown_or_reservation_unavailable");
  started=true;
  const result=await adapters.sendBenchmark(BENCHMARK_SCOPE);
  // HTTP acceptance is not a completed result or a passing score.
  const status=Number.isInteger(result?.status)?result.status:null;
  return {state:status>=200&&status<300?"upstream_accepted_unverified":status===429?"rate_limited":"upstream_not_confirmed",attempted:true,confirmed:false,upstream_status:status};
 }catch{return started?{state:"transport_uncertain",attempted:true,confirmed:false}:held("verification_unavailable");}
}
