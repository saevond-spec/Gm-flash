// Sprite-only DRY RUN for high-accuracy buyer messaging and bid safety.
// This module has NO marketplace writer, no key, no signing authority,
// no live Mother/Nova service bindings, and never issues a bid permit.
// All examples and reviewer outputs used in tests are fictional.
const ID=/^[1-9][0-9]{0,9}$/;
const safeInt=(x,lo,hi)=>Number.isSafeInteger(x)&&x>=lo&&x<=hi;
const hold=(reason,extra={})=>({state:'hold',reason,can_submit:false,submitted:false,...extra});
const cleanText=x=>typeof x==='string'&&x.trim().length>=24&&x.length<=1000;
const forbidden=/(guaranteed\s+(?:approval|acceptance|payment)|100%\s+acceptance|already\s+completed|we\s+already\s+tested|no\s+risks?\s+at\s+all)/i;
const validRequirement=x=>typeof x==='string'&&x.trim().length>=12&&x.length<=160;

export async function simulateSpriteResubmissionReview({
  task,agentId,quoteCents,existingReservation,proposal,buyerMessage,
  motherReview,novaReview
}={}){
  if(agentId!==1878||!task||!ID.test(String(task.problem_id??'')))
    return hold('task_or_agent_identity_unverified');
  if(!existingReservation||existingReservation.problem_id!==String(task.problem_id)
    ||existingReservation.agent_id!==1878)
    return hold('existing_bid_state_unknown');
  // Most important rule: an unresolved task #3298 is NOT permission to retry.
  // Even an ideal bid proposal and two apparent approvals cannot override this.
  if(existingReservation.state==='uncertain')
    return hold('unknown_previous_submission_do_not_retry',{requires_authoritative_receipt:true});
  if(existingReservation.state==='submitted')
    return hold('already_submitted_do_not_retry');
  if(existingReservation.state==='reserved')
    return hold('existing_reservation_must_be_reconciled');
  if(existingReservation.state!=='none')
    return hold('prior_bid_status_requires_manual_review');
  if(task.source!=='authenticated_task_detail'||task.status!=='bidding'
    ||task.currency!=='USD'||task.simulated===true
    ||task.scope_verified!==true||task.delivery_isolated!==true
    ||task.acceptance_complete!==true
    ||!safeInt(task.verified_floor_cents,0,2000)
    ||!safeInt(task.verified_budget_cents,500,2000)
    ||!safeInt(quoteCents,Math.max(500,task.verified_floor_cents),task.verified_budget_cents)
    ||task.incremental_cost_cents!==0)
    return hold('task_or_price_evidence_incomplete');
  if(!Array.isArray(task.requirements)||!task.requirements.length
    ||task.requirements.length>8||!task.requirements.every(validRequirement)
    ||new Set(task.requirements).size!==task.requirements.length)
    return hold('acceptance_criteria_missing_or_duplicated');
  if(!cleanText(proposal)||!cleanText(buyerMessage)||forbidden.test(proposal)
    ||forbidden.test(buyerMessage))
    return hold('unsupported_or_unbounded_bid_claims');
  // Each independently supplied criterion must be covered in the bid.
  // Keyword presence is only a simulation-level structural check, not proof
  // that Sprite can deliver the actual job.
  const missing=task.requirements.filter(r=>!proposal.includes(r));
  if(missing.length)return hold('acceptance_coverage_incomplete',{missing_count:missing.length});
  if(!proposal.includes('Verification:')||!proposal.includes('Deliverables:')
    ||!proposal.includes('Exclusions:')||!proposal.includes('Timeline:'))
    return hold('proposal_structure_incomplete');
  if(!buyerMessage.includes('Acceptance criteria')||
    !buyerMessage.includes('verification evidence')||
    !buyerMessage.includes('fixed quote'))
    return hold('buyer_message_not_bound_to_bid');
  if(typeof motherReview!=='function'||typeof novaReview!=='function')
    return hold('independent_advisory_reviewers_missing');
  // Fictional reviewers cannot mint actual Nova or operator authorization.
  let mother,nova;
  try{mother=await motherReview({task,quoteCents,proposal,buyerMessage});
      if(mother?.decision!=='pass')return hold('mother_advisory_review_hold');
      nova=await novaReview({task,quoteCents,proposal,buyerMessage});
      if(nova?.decision!=='pass')return hold('nova_advisory_review_hold');}
  catch{return hold('reviewer_unavailable');}
  return {state:'fictional_draft_passed_advisory_reviews',
    reason:'separate_live_approval_and_fresh_receipt_reconciliation_required',
    can_submit:false,submitted:false,
    mother_reviewed_in_simulation:true,nova_reviewed_in_simulation:true,
    requirement_count:task.requirements.length,quote_cents:quoteCents,
    escrow_required:false};
}
