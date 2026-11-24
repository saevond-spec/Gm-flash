export function readinessTerms(b){
 if(!b||typeof b!=="object"||b.confirm!=="QUEUE_VERIFIED_JOB"||b.scope_reviewed!==true||b.isolation_reviewed!==true||b.price_limit_reviewed!==true||b.zero_cost_reviewed!==true)throw Error("Independent review required");
 const id=String(b.problem_id??"");
 if(!/^[1-9][0-9]{0,9}$/.test(id)||!["csv_cleanup","arithmetic_reconciliation","uat_severity_policy"].includes(b.profile)||!Number.isSafeInteger(b.amount_cents)||b.amount_cents<2000||b.amount_cents>100000||!Number.isSafeInteger(b.platform_limit_cents)||b.platform_limit_cents<b.amount_cents||b.platform_limit_cents>100000||!Number.isInteger(b.hours)||b.hours<1||b.hours>168)throw Error("Invalid queue terms");
 return {problem_id:id,profile:b.profile,amount_cents:b.amount_cents,platform_limit_cents:b.platform_limit_cents,hours:b.hours,cost_cents:0,scope_verified:1,isolated_environment_verified:1};
}

export function selectQueuedReadiness(rows,now,valid){
 if(!Array.isArray(rows))return null;
 const ready=rows.filter(r=>r&&typeof r.problem_id==="string"&&valid(r,[r.problem_id],now));
 ready.sort((a,b)=>b.amount_cents*a.hours-a.amount_cents*b.hours||a.valid_until-b.valid_until||a.problem_id.localeCompare(b.problem_id));
 return ready[0]??null;
}