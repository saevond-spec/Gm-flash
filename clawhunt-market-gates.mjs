// Sprite-only *read-only* ClawHunt gate model for synthetic rehearsals.
// Current thresholds MUST come from an independently authenticated/current
// marketplace response. Never infer defaults when a lookup fails.
// Output contains no customer titles, descriptions, credentials, or proposal text.
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const id=/^[1-9][0-9]{0,9}$/;
const forbidden=/(?:placeholder|lorem\s+ipsum|占位)/iu;
const unique=a=>Array.isArray(a)&&new Set(a).size===a.length;
export function assessClawhuntBidGates({intent,task,agent,standing,criteria,heartbeat,proposalText,nowSec}={}) {
  const problems=[];
  if(!integer(nowSec,1,Number.MAX_SAFE_INTEGER))problems.push('trusted_time_missing');
  if(!intent||!id.test(intent.problem_id)||intent.agent_id!==1878||
    !integer(intent.amount_cents,500,2000))problems.push('invalid_bid_identity_or_quote');
  if(!criteria||criteria.source!=='official_criteria'||criteria.verified!==true||
    !integer(criteria.checked_at_sec,nowSec-300,nowSec)||
    !integer(criteria.min_combined_characters,10,5000)||
    !integer(criteria.heartbeat_window_sec,1,86400))problems.push('current_official_criteria_missing');
  if(!agent||agent.source!=='authenticated_me'||agent.verified!==true||
    agent.agent_id!==1878||agent.admission_status!=='approved'||agent.owner_active!==true)
    problems.push('agent_admission_or_owner_not_verified');
  if(!standing||standing.source!=='authenticated_standing'||standing.verified!==true||
    standing.held_back!==false||standing.account_paused!==false||
    standing.own_bid_exists!==false||standing.eligible_for_task!==true||
    !integer(standing.checked_at_sec,nowSec-300,nowSec))
    problems.push('standing_unknown_or_held_back');
  if(!heartbeat||heartbeat.status!==200||heartbeat.agent_id!==1878||
    !integer(heartbeat.ack_sec,nowSec-(criteria?.heartbeat_window_sec??0),nowSec))
    problems.push('heartbeat_stale_or_unacknowledged');
  if(!task||task.source!=='authenticated_detail'||task.verified!==true||
    task.id!==intent?.problem_id||task.currency!=='USD'||
    !['open','bidding'].includes(task.status)||task.simulated!==false||
    task.funding_status!=='held'||task.self_owned!==false||task.own_bid_exists!==false||
    !integer(task.price_floor_cents,0,intent?.amount_cents??-1)||
    !integer(task.budget_cents,intent?.amount_cents??0,2000)||
    !integer(task.checked_at_sec,nowSec-300,nowSec))
    problems.push('task_status_price_funding_unknown_or_changed');
  if(!task||task.acceptance_verified!==true||task.isolated_delivery_verified!==true||
    task.zero_incremental_cost!==true||task.deadline_feasible!==true)
    problems.push('delivery_scope_or_zero_cost_not_proven');
  if(typeof proposalText!=='string'||!criteria||
    proposalText.trim().length < criteria.min_combined_characters||
    proposalText.length>1000||forbidden.test(proposalText))
    problems.push('proposal_text_rejected');
  if(!task||!unique(task.acceptance_ids)||task.acceptance_ids.length===0||
     task.acceptance_ids.length>20||!unique(task.covered_acceptance_ids)||
     task.covered_acceptance_ids.length!==task.acceptance_ids.length||
     !task.acceptance_ids.every(x=>typeof x==='string'&&x.length>0&&
       task.covered_acceptance_ids.includes(x)))
    problems.push('acceptance_coverage_not_verified');
  return {eligible_for_further_independent_approval:problems.length===0,
    can_submit:false,
    reasons:problems,
    evidence_kind:'synthetic_or_read_only',
    external_signature_and_reservation_still_required:true};
}
