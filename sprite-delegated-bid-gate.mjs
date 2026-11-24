// Sprite #1878 — delegated operator authority for vetted bids.
// Mother/Nova may advise but are not cryptographic co-signers for a marketplace POST.
// All policy inputs are server-side; never trust browser-supplied authorization flags.
// No network calls, customer data, credentials, or mutations in this module.
export function evaluateDelegatedBidAuthorization({policy, agent, row, task, assessment, bounds, payload, canonicalPayload, nowSeconds}) {
  const reasons=[];
  const id=String(row?.problem_id??'');
  const n=x=>Number.isSafeInteger(x);
  if(policy?.operator_authorized!==true||policy?.automatic_submission_enabled!==true)reasons.push('operator_delegation_disabled');
  if(Number(agent?.id??agent?.agent_id)!==1878||agent?.name!=='Sprite'||agent?.admission_status!=='approved')reasons.push('sprite_identity_not_approved');
  if(!/^[1-9][0-9]{0,9}$/.test(id)||String(task?.id??task?.problem_id??'')!==id||bounds?.problem_id!==id)reasons.push('task_identity_mismatch');
  if(!['open','bidding'].includes(String(task?.status??'').toLowerCase())||String(task?.currency??'').toUpperCase()!=='USD'||task?.is_simulated===true||task?.simulated===true)reasons.push('task_not_biddable');
  if(task?.deadline!==undefined&&task.deadline!==null) {
    const deadline=Date.parse(task.deadline);
    if(!Number.isFinite(deadline)||!n(nowSeconds)||deadline<=nowSeconds*1000)reasons.push('deadline_expired_or_invalid');
  }
  if(row?.scope_verified!==1||row?.isolated_environment_verified!==1||row?.rehearsal_passed!==1||row?.cost_cents!==0)reasons.push('scope_isolation_or_rehearsal_not_verified');
  if(!n(nowSeconds)||!n(row?.verified_at)||!n(row?.valid_until)||row.verified_at>nowSeconds||row.verified_at<nowSeconds-86400||row.valid_until<=nowSeconds||row.valid_until>row.verified_at+86400)reasons.push('readiness_stale');
  if(!['csv_cleanup','arithmetic_reconciliation','uat_severity_policy'].includes(row?.profile)||!n(row?.hours)||row.hours<1||row.hours>168)reasons.push('unsupported_delivery_profile');
  const amount=row?.amount_cents;
  if(!n(amount)||amount<2000||amount>100000||!n(row?.platform_limit_cents)||amount>row.platform_limit_cents)reasons.push('operator_quote_bounds');
  if(assessment?.eligible!==true||assessment?.simulated_flag===true||assessment?.budget_cents!==bounds?.budget_cents||bounds?.ok!==true)reasons.push('live_marketplace_evidence_invalid');
  if(!n(bounds?.price_floor_cents)||!n(bounds?.budget_cents)||!n(amount)||amount<bounds.price_floor_cents||amount>bounds.budget_cents)reasons.push('marketplace_quote_bounds');
  if(!payload||payload.amount!==amount||typeof payload.message!=='string'||payload.message.length<10||payload.message.length>1000||typeof payload.proposal_text!=='string'||payload.proposal_text.length<120||payload.proposal_text.length>5000||typeof payload.estimated_time!=='string'||!payload.estimated_time||payload.estimated_time.length>100)reasons.push('buyer_copy_incomplete');
  if(typeof canonicalPayload!=='string'||canonicalPayload.length<120||canonicalPayload.length>12000)reasons.push('payload_not_frozen');
  return {ok:reasons.length===0,reasons,authorization:'operator_delegation_plus_fresh_evidence',agent_id:1878,problem_id:id};
}
