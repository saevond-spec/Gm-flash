/**
 * Sprite #1878 bid acceptance preflight. PUBLIC brief only.
 * Pure / no I/O, persistence, credentials, customer data, bid writes or model calls.
 * Validates structural *traceability*, NOT meaning, accuracy, or official ClawHunt scores.
 */
const plain=x=>typeof x==='string'&&x.trim().length>0;
const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
export function reviewPublicAcceptancePlan(input){
  const reasons=[],perCriterion=[];
  if(!input||typeof input!=='object'||Array.isArray(input))return {
    structural_coverage_percent:0,criteria_count:0,structured_criteria_covered:0,
    passed_structural_review:false,requires_independent_semantic_review:true,
    permits_marketplace_submission:false,reasons:['missing_public_brief']};
  const criteria=input.public_criteria,checks=input.acceptance_checks;
  if(!Array.isArray(criteria)||!criteria.length||criteria.length>40||
     criteria.some(x=>!plain(x)||x.length>2000))reasons.push('invalid_public_acceptance_criteria');
  if(!Array.isArray(checks)||checks.length>40)reasons.push('invalid_acceptance_check_items');
  if(input.agent_id!==1878)reasons.push('sprite_agent_identity_required');
  if(!['open','bidding'].includes(input.task_status))reasons.push('task_not_open');
  if(!integer(input.amount_cents,2000,100000))reasons.push('quote_outside_executable_range');
  if(!integer(input.budget_cents,2000,10000000)||!integer(input.price_floor_cents,0,10000000)||
     !integer(input.amount_cents,input.price_floor_cents??0,input.budget_cents??0))
    reasons.push('marketplace_quote_bounds_unverified');
  if(!integer(input.estimated_hours,1,168))reasons.push('invalid_delivery_schedule');
  if(input.additional_spend_cents!==0)reasons.push('additional_spending_not_permitted');
  if(input.delivery_capability_verified!==true)reasons.push('delivery_capability_not_independently_verified');
  if(input.identity_approved!==true||input.task_identity_verified!==true)reasons.push('task_or_identity_not_verified');
  if(input.duplicate_status_clear!==true)reasons.push('existing_or_uncertain_bid_must_be_reconciled');
  let covered=0;
  if(Array.isArray(criteria)&&criteria.length&&criteria.length<=40&&Array.isArray(checks)){
    const buckets=new Map();
    for(const c of checks){
      const idx=c?.criterion_index;
      if(!integer(idx,1,criteria.length)){reasons.push('invalid_criterion_index');continue;}
      buckets.set(idx,[...(buckets.get(idx)??[]),c]);
    }
    for(let i=1;i<=criteria.length;i++){
      const variants=buckets.get(i)??[];
      const one=variants.length===1?variants[0]:null;
      const mapped=!!one&&plain(one.plan)&&one.plan.trim().length>=30&&one.plan.length<=1000&&
        plain(one.verification_steps)&&one.verification_steps.trim().length>=25&&
        one.verification_steps.length<=1000&&plain(one.deliverable_format)&&
        one.deliverable_format.length<=150&&one.capability_confirmed===true;
      if(mapped)covered++;
      perCriterion.push({criterion_index:i,mapped,reason:variants.length>1?
        'duplicate_mapping':variants.length===0?'missing_mapping':
        mapped?'structured_check_complete':'plan_or_evidence_incomplete'});
    }
  }
  const total=Array.isArray(criteria)&&criteria.length<=40?criteria.length:0;
  if(total===0||covered!==total)reasons.push('acceptance_criteria_not_fully_mapped');
  const coverage=total?Math.floor(100*covered/total):0;
  return {
    structural_coverage_percent:coverage,
    criteria_count:total,structured_criteria_covered:covered,
    per_criterion:perCriterion,
    passed_structural_review:reasons.length===0,
    requires_independent_semantic_review:true,
    permits_marketplace_submission:false,
    reasons:[...new Set(reasons)],
    score_kind:'internal_structural_coverage_not_official'
  };
}
