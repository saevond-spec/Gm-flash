// Sprite-only, scalar-metadata campaign planner. NO NETWORK, SEND, OR AUTHORIZATION.
// Intended to produce a review candidate; actual ClawHunt writes require separate
// authenticated Nova + operator approvals, D1 nonce/reservation, and live recheck.
// Never pass task descriptions, client files, proposals, credentials or secrets here.
const ID=/^[1-9]\d{0,9}$/;
const integer=(v,lo,hi)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi;
export const SPRITE_CAMPAIGN_LIMITS=Object.freeze({
  agent_id:1878,min_quote_cents:500,max_quote_cents:2000,
  max_recommendations_per_cycle:1,max_evidence_age_sec:300,
  incremental_spend_cents:0,legacy_quarantine_id:'3298'
});
const stop=(state,detail=null)=>({
  state,detail,can_submit:false,marketplace_posts:0,
  requires_authenticated_council_release:true,recommendations:[]
});
const fresh=(v,now)=>integer(v,now-SPRITE_CAMPAIGN_LIMITS.max_evidence_age_sec,now);
function reviewRow(row,now){
  const reasons=[];
  if(!row||typeof row!=='object'||!ID.test(row.problem_id)||row.problem_id==='3298')reasons.push('bad_or_quarantined_id');
  if(row?.source!=='authenticated_task_detail'||row?.verified!==true||!fresh(row?.checked_at_sec,now))reasons.push('detail_unverified_or_stale');
  if(row?.queue_source!=='authenticated_bid_queue'||!fresh(row?.queue_checked_at_sec,now))reasons.push('floor_unverified_or_stale');
  if(!integer(row?.posted_at_sec,1,now))reasons.push('posting_time_missing');
  if(!['open','bidding'].includes(row?.status)||row?.currency!=='USD'||row?.simulated!==false||row?.self_owned!==false)reasons.push('task_unavailable');
  if(!integer(row?.budget_cents,500,2000)||!integer(row?.floor_cents,0,row?.budget_cents??-1)
    ||!integer(row?.quote_cents,500,2000)||row.quote_cents<row.floor_cents||row.quote_cents>row.budget_cents)reasons.push('quote_or_floor_invalid');
  if(row?.own_bid_exists!==false||row?.existing_reservation!==false)reasons.push('bid_or_reservation_exists');
  if(row?.escrow_status!=='held')reasons.push('not_held_for_initial_canary');
  if(row?.acceptance_criteria_verified!==true||row?.acceptance_coverage_verified!==true
    ||row?.isolated_delivery_verified!==true||row?.fictional_rehearsal_passed!==true
    ||row?.zero_incremental_cost!==true||row?.deadline_feasible!==true)reasons.push('delivery_not_proven');
  if(!integer(row?.estimated_minutes,15,240))reasons.push('duration_unverified');
  return reasons;
}
export function planSpriteMultiBidCycle({nowSec,agent,standing,criteria,heartbeat,capacity,
  reservations,candidates}={}){
  if(!integer(nowSec,1,Number.MAX_SAFE_INTEGER))return stop('invalid_clock');
  if(agent?.source!=='authenticated_me'||agent?.verified!==true||agent.agent_id!==1878
    ||agent.admission_status!=='approved'||agent.owner_active!==true
    ||!fresh(agent.checked_at_sec,nowSec))return stop('agent_identity_unverified');
  if(standing?.source!=='authenticated_standing'||standing?.verified!==true
    ||standing.held_back!==false||standing.account_paused!==false
    ||!fresh(standing.checked_at_sec,nowSec))return stop('bid_standing_unverified_or_blocked');
  if(criteria?.source!=='official_criteria'||criteria.verified!==true
    ||!fresh(criteria.checked_at_sec,nowSec)
    ||!integer(criteria.heartbeat_window_sec,1,86400))return stop('official_criteria_unverified');
  if(heartbeat?.agent_id!==1878||heartbeat.status!==200
    ||!integer(heartbeat.ack_sec,nowSec-criteria.heartbeat_window_sec,nowSec))return stop('heartbeat_missing_or_stale');
  if(capacity?.verified!==true||!fresh(capacity.checked_at_sec,nowSec)
    ||!integer(capacity.open_orders,0,Number.MAX_SAFE_INTEGER)
    ||!integer(capacity.allowed_open_orders,1,Number.MAX_SAFE_INTEGER)
    ||capacity.open_orders>=capacity.allowed_open_orders)return stop('delivery_capacity_unverified_or_full');
  if(!Array.isArray(reservations))return stop('ledger_snapshot_missing');
  for(const r of reservations){
    if(r?.agent_id!==1878||!ID.test(r.problem_id)
      ||!['reserved','uncertain','confirmed','rejected','quarantined'].includes(r.state))
      return stop('ledger_state_invalid');
    if(r.problem_id==='3298'&&r.state!=='uncertain'&&r.state!=='quarantined')
      return stop('legacy_quarantine_integrity_failed');
    if(r.problem_id!=='3298'&&['reserved','uncertain'].includes(r.state))
      return stop('new_bid_receipt_unresolved',r.problem_id);
  }
  if(!Array.isArray(candidates))return stop('candidate_snapshot_missing');
  const seen=new Map(),conflicts=new Set();
  for(const row of candidates.slice(0,250)){
    if(!row||typeof row.problem_id!=='string'||!ID.test(row.problem_id))continue;
    // Two different versions of a task in the same scan are not safe to promote.
    const signature=JSON.stringify([row.quote_cents,row.budget_cents,row.floor_cents,
      row.status,row.escrow_status,row.checked_at_sec,row.queue_checked_at_sec,
      row.posted_at_sec,row.own_bid_exists,row.existing_reservation]);
    if(seen.has(row.problem_id)){
      if(seen.get(row.problem_id).signature!==signature)conflicts.add(row.problem_id);
    }else seen.set(row.problem_id,{row,signature});
  }
  const eligible=[];
  for(const [id,{row}] of seen){
    if(conflicts.has(id)||reservations.some(r=>r.problem_id===id))continue;
    if(reviewRow(row,nowSec).length===0)eligible.push(row);
  }
  // ClawHunt's model queue is oldest-first. Prefer older verified held tasks,
  // breaking ties by better net return / minute; no invented win probability.
  eligible.sort((a,b)=>a.posted_at_sec-b.posted_at_sec
    || (b.quote_cents*3/b.estimated_minutes)-(a.quote_cents*3/a.estimated_minutes)
    || a.problem_id.localeCompare(b.problem_id));
  if(!eligible.length)return stop('no_independently_screened_candidate',
    {reviewed_unique:seen.size,conflicting_task_ids:[...conflicts].slice(0,20)});
  const first=eligible[0];
  return {
    state:'candidate_for_independent_approval_only',can_submit:false,marketplace_posts:0,
    requires_authenticated_council_release:true,
    recommendations:[{
      problem_id:first.problem_id,quote_cents:first.quote_cents,
      verified_budget_cents:first.budget_cents,verified_floor_cents:first.floor_cents,
      posted_at_sec:first.posted_at_sec,estimated_minutes:first.estimated_minutes,
      next_action:'private_proposal_review_then_exact_signed_approvals',
      predicted_win_probability:null,
      fee_estimate_cents:Math.ceil(first.quote_cents*25/100),
      payout_if_settled_cents:first.quote_cents-Math.ceil(first.quote_cents*25/100)
    }],
    reviewed_unique:seen.size,conflicting_task_ids:[...conflicts].slice(0,20)
  };
}
