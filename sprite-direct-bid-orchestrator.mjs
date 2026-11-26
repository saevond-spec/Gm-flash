/**
 * Sprite #1878 direct submission orchestrator (DRAFT, NOT DEPLOYED).
 * Dependency injection lets the Worker use its *existing* trusted authenticated
 * readers, reservation-based one-send writer, and independent receipt verifier.
 *
 * No archived readiness queue, mandatory council votes, pre-award customer
 * workspace or exhaustive pre-bid scope review.
 *
 * NEVER pass customer materials or other-agent state through this path.
 * Detailed scope and customer-specific sandbox remain post-award only.
 */
import {evaluateSpriteDirectPrebid} from './sprite-direct-prebid.mjs';
const taskId=x=>{
  const raw=(x&&typeof x==='object'&&!Array.isArray(x))?(x.problem_id??x.id):x;
  const id=typeof raw==='number'&&Number.isSafeInteger(raw)?String(raw):raw;
  return typeof id==='string'&&/^[1-9]\d{0,9}$/.test(id)?id:null;
};
const safe=x=>typeof x==='string'&&x.length<=128?x:null;

export async function submitSpriteDirectOnce({problem_id,deps,nowMs=Date.now(),delegated=false}={}){
  const id=taskId(problem_id);
  const required=['getSpriteIdentity','getAuthenticatedTask','getPublicAuthenticityEvidence',
    'getOwnBidHistory','createPublicOnlyProposal','reserveAndSendOnce','readAuthenticatedBidReceipt'];
  if(!id||!deps||required.some(key=>typeof deps[key]!=='function')||delegated!==true)
    return {state:'configuration_or_delegation_missing',attempted:false,confirmed:false,problem_id:id};
  // Do not spend on proposal generation when earlier deterministic evidence
  // already demonstrates a blocked, duplicate or simulated listing.
  let agent,task,publicEvidence,existing;
  try {
    [agent,task,publicEvidence,existing]=await Promise.all([
      deps.getSpriteIdentity(),deps.getAuthenticatedTask(id),
      deps.getPublicAuthenticityEvidence(id),deps.getOwnBidHistory(id)
    ]);
  } catch {
    return {state:'authoritative_read_unavailable',attempted:false,confirmed:false,problem_id:id};
  }
  if(taskId(task)!==id||task?.authenticated!==true||task?.identity_verified!==true||
    Number(agent?.id??agent?.agent_id)!==1878||agent?.authenticated!==true||
    agent?.admission_status!=='approved'||agent?.webhook_matches_approved_sprite!==true)
    return {state:'identity_or_listing_unverified',attempted:false,confirmed:false,problem_id:id};
  if(existing?.authoritative!==true)
    return {state:'own_bid_history_unverified',attempted:false,confirmed:false,problem_id:id};
  if(task?.public_only_brief_verified!==true)
    return {state:'public_brief_isolation_unverified',attempted:false,confirmed:false,problem_id:id};
  if(existing?.reservation===true||existing?.receipt===true||
     existing?.own_marketplace_bid===true||existing?.uncertain===true)
    return {state:'existing_bid_requires_reconciliation',attempted:false,confirmed:false,problem_id:id};
  const simulated=task.simulated===true||task.simulated===1||task.is_simulated===true||
     task.is_simulated===1||task.is_simulation===true||task.is_simulation===1||
     publicEvidence?.simulated_bounty_banner===true||publicEvidence?.simulated===true;
  if(simulated)return {state:'simulated_bounty_excluded',attempted:false,confirmed:false,problem_id:id};
  // Proposal preparation must run inside the separate, isolated per-task
  // public-brief reviewer and return only the frozen bid fields. NEVER pass
  // the full task object, customer files, prompts or attachments into Sprite's
  // shared inventory, model context, logs, council/other-agent bindings or GitHub.
  let proposal;
  try {proposal=await deps.createPublicOnlyProposal({problem_id:id,access:'isolated_public_brief_only'});}
  catch {return {state:'public_proposal_unavailable',attempted:false,confirmed:false,problem_id:id};}
  const decision=evaluateSpriteDirectPrebid({agent,task,proposal,existing,publicEvidence,nowMs,delegated});
  if(!decision.prebid_feasible)
    return {state:'prebid_evidence_incomplete',attempted:false,confirmed:false,
      problem_id:id,reasons:decision.reasons,requires_post_award_scope_review:true};
  // reserveAndSendOnce MUST atomically enforce UNIQUE(agent_id,problem_id).
  // NEVER retry a timed-out POST; the outcome may already be committed.
  let send;
  try {send=await deps.reserveAndSendOnce({problem_id:id,agent_id:1878,
    proposal,amount_cents:proposal.amount_cents});}
  catch{return {state:'uncertain_send_do_not_retry',attempted:true,confirmed:false,problem_id:id};}
  if(send?.outcome==='duplicate'||send?.outcome==='blocked')
    return {state:'reservation_or_marketplace_rejected',attempted:false,confirmed:false,problem_id:id};
  if(send?.outcome!=='posted')
    return {state:'uncertain_send_do_not_retry',attempted:send?.attempted===true,
      confirmed:false,problem_id:id};
  // A heartbeat and an HTTP 200 are NOT a bid receipt. Require matching
  // authenticated marketplace record with agent/task/amount/bid ID.
  let receipt;
  try {receipt=await deps.readAuthenticatedBidReceipt(id);}
  catch{return {state:'await_authenticated_receipt_do_not_retry',attempted:true,confirmed:false,problem_id:id};}
  const confirmed=receipt?.agent_id===1878&&taskId(receipt?.problem_id)===id&&
    receipt?.amount_cents===proposal.amount_cents&&
    typeof receipt?.bid_id==='string'&&/^[a-zA-Z0-9._-]{3,128}$/.test(receipt.bid_id)&&
    ['pending','submitted','accepted','selected'].includes(receipt?.status);
  if(!confirmed)return {state:'receipt_mismatch_do_not_retry',attempted:true,confirmed:false,problem_id:id};
  return {state:'authenticated_bid_confirmed',attempted:true,confirmed:true,
    problem_id:id,bid_id:safe(receipt.bid_id),amount_cents:proposal.amount_cents};
}
