// Sprite control plane: scalar public evidence only. Never reads or stores customer material.
export function evaluateReadiness(e,now){
 const reasons=[];const validInt=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
 if(!e||typeof e!=="object")return {ready:false,reasons:["missing_evidence"]};
 if(typeof e.problem_id!=="string"||!/^[1-9]\d{0,9}$/.test(e.problem_id))reasons.push("identity");
 if(!["csv_cleanup","arithmetic_reconciliation"].includes(e.profile))reasons.push("profile");
 if(!validInt(e.amount_cents,2000,100000)||!validInt(e.platform_limit_cents,500,100000000)||e.amount_cents>e.platform_limit_cents)reasons.push("price");
 if(!validInt(e.hours,1,168)||e.cost_cents!==0)reasons.push("cost_or_schedule");
 if(e.scope_verified!==1)reasons.push("scope");
 if(e.isolated_environment_verified!==1)reasons.push("isolation");
 if(e.rehearsal_passed!==1)reasons.push("rehearsal");
 if(!validInt(e.verified_at,now-86400,now)||!validInt(e.valid_until,now+1,Number.MAX_SAFE_INTEGER)||e.valid_until>e.verified_at+86400)reasons.push("freshness");
 return {ready:reasons.length===0,reasons};
}
export function recommendReview(task,review,now){
 if(!task||typeof task.problem_id!=="string"||!/^[1-9]\d{0,9}$/.test(task.problem_id))return {state:"invalid_identity"};
 if(!["bidding","open"].includes(task.status)||task.qualified!==true)return {state:"not_qualified"};
 if(review?.problem_id===task.problem_id&&review.capability_result==="unsupported_profile"&&Number.isFinite(Date.parse(review.observed_at))&&Date.parse(review.observed_at)<=now&&now-Date.parse(review.observed_at)<86400000)return {state:"known_unsupported"};
 if(!Number.isSafeInteger(task.verified_budget_cents)||task.verified_budget_cents<500)return {state:"price_evidence_required"};
 return {state:"independent_scope_and_isolation_review_required"};
}
