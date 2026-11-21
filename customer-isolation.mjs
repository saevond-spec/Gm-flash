// Admission policy only. This module does NOT provision or attest a sandbox.
// Evidence must be produced by a trusted infrastructure verifier, never by customer code.
export const REQUIRED_ISOLATION=Object.freeze(["dedicated_job_runtime","dedicated_storage","no_parent_credentials","no_cross_customer_bindings","network_default_deny","private_ingress","resource_limits","verified_destroy","zero_additional_cost"]);
export function assessIsolation({job_id,environment_id,provider,verified_controls}={},trustedEvidence=null){
 const reasons=[];
 if(typeof job_id!=="string"||!/^[1-9]\d{0,9}$/.test(job_id))reasons.push("invalid_job_id");
 if(typeof environment_id!=="string"||!/^sprite-job-[1-9]\d{0,9}-[a-f0-9]{16}$/.test(environment_id)||!environment_id.startsWith("sprite-job-"+job_id+"-"))reasons.push("environment_job_binding_invalid");
 if(!["dynamic_workers","dedicated_worker","isolated_container"].includes(provider))reasons.push("unsupported_provider");
 // Until a trusted provisioner exists, callers cannot pass an attestation to unlock execution.
 // Free static Workers have no independently established default-deny egress guarantee.
 reasons.push("trusted_infrastructure_verifier_not_connected");
 if(provider==="dedicated_worker")reasons.push("infrastructure_network_default_deny_unverified");
 for(const c of REQUIRED_ISOLATION)if(verified_controls?.[c]!==true)reasons.push("missing_"+c);
 return {job_id:typeof job_id==="string"?job_id:null,eligible:false,customer_execution_allowed:false,provisioned:false,automatic_bid_allowed:false,reasons,policy_version:1,attestation_accepted:false};
}
