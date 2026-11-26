/**
 * Sprite #1878 — direct, low-friction pre-bid eligibility review.
 *
 * Pure, no network, no secret reads, no other-agent calls, no customer content,
 * no bid writes or authority to submit. Caller MUST pass authenticated,
 * independently verified marketplace facts and a separately approved Sprite
 * identity. All returned evidence is advisory until checked in the trusted
 * Worker before its existing single-send/receipt mechanism.
 *
 * Remove: readiness-table queue, pre-award workspace certificate, mandatory
 * council votes, exhaustive buyer acceptance mapping, fictional rehearsals.
 * Keep: identity, real task/authenticity, credible capability, valid proposal
 * and quote, deadline, zero extra spend, owner-delegated authority, duplicate
 * protection and marketplace read-back receipt.
 */

const idOf = x => {
  const raw=x?.problem_id??x?.id??x;
  const id=typeof raw==="number"&&Number.isSafeInteger(raw)?String(raw):raw;
  return typeof id==="string"&&/^[1-9][0-9]{0,9}$/.test(id)?id:null;
};
const isSimulated=x=>x?.simulated===true||x?.simulated===1||
  x?.is_simulated===true||x?.is_simulated===1||
  x?.is_simulation===true||x?.is_simulation===1||
  String(x?.bounty_type??"").toLowerCase()==="simulated"||
  x?.verification_state==="public_page_simulated_nonpaying";
const explicitlyReal=x=>x?.simulated===false||x?.simulated===0||
  x?.is_simulated===false||x?.is_simulated===0||
  x?.is_simulation===false||x?.is_simulation===0;
const validCents=n=>Number.isSafeInteger(n)&&n>0&&n<=10000000;
const text=x=>typeof x==="string"?x.trim():"";
const present=x=>text(x).length>0;

export function evaluateSpriteDirectPrebid({
  agent,task,proposal,existing={},publicEvidence={},nowMs=Date.now(),delegated=false
}={}){
  const reasons=[];
  const reject=key=>{if(!reasons.includes(key))reasons.push(key);};
  const id=idOf(task);
  const identityId=agent?.agent_id??agent?.id;
  if(Number(identityId)!==1878||agent?.authenticated!==true||
     agent?.admission_status!=="approved"||
     agent?.webhook_matches_approved_sprite===false ||
     agent?.webhook_matches_approved_sprite!==true) reject("sprite_identity_unverified");
  if(!Number.isFinite(nowMs)||nowMs<946684800000)reject("clock_unverified");
  if(!id||task?.authenticated!==true||task?.identity_verified!==true)
    reject("authentic_task_detail_unavailable");
  const observed=Date.parse(task?.fetched_at??"");
  if(!Number.isFinite(observed)||observed>nowMs||nowMs-observed>10*60000)
    reject("task_detail_not_fresh");
  if(!["open","bidding"].includes(String(task?.status??"").toLowerCase()))
    reject("task_not_open");
  if(String(task?.currency??"").toUpperCase()!=="USD")
    reject("currency_not_usd");
  const conflicting = isSimulated(task)||isSimulated(publicEvidence)||publicEvidence?.simulated_bounty_banner===true;
  if(conflicting)reject("simulated_or_nonpaying_bounty");
  const explicitReal=explicitlyReal(task)||(
    publicEvidence?.authenticated===true&&publicEvidence?.task_id===id&&
    publicEvidence?.explicit_non_simulated_verified===true&&
    Number.isFinite(Date.parse(publicEvidence?.verified_at??""))&&
    Date.parse(publicEvidence.verified_at)<=nowMs&&
    nowMs-Date.parse(publicEvidence.verified_at)<=10*60000
  );
  if(!explicitReal)reject("simulation_authenticity_not_verified");
  const escrow=String(task?.escrow_status??"").toLowerCase();
  const noEscrow=escrow==="none"||escrow==="unfunded";
  const funded=escrow==="funded"||escrow==="held";
  if(!noEscrow&&!funded)reject("funding_mode_unknown");
  if(funded&&task?.escrow_funded===false)reject("funding_fields_conflict");
  if(noEscrow&&task?.escrow_funded===true)reject("funding_fields_conflict");
  const reference=noEscrow?task?.reference_price:task?.price;
  if(!validCents(reference))reject("advertised_budget_not_verified");
  const budget=validCents(reference)?reference:null;
  const amount=proposal?.amount_cents;
  if(!Number.isSafeInteger(amount)||amount<2000||amount>100000||
     budget===null||amount>budget)
    reject("price_outside_verified_bounds");
  if(proposal?.additional_spend_cents!==0)
    reject("nonzero_additional_spending");
  if(proposal?.task_id!==id)reject("proposal_task_mismatch");
  if(proposal?.capability_verified!==true||proposal?.can_deliver_public_brief!==true)
    reject("delivery_capability_not_verified");
  if(!present(proposal?.approach)||text(proposal?.approach).length<25||
     !present(proposal?.verification_plan)||text(proposal?.verification_plan).length<20)
    reject("meaningful_delivery_plan_missing");
  if(!present(proposal?.buyer_message)||text(proposal?.buyer_message).length<10||
     text(proposal?.buyer_message).length>1000)
    reject("buyer_message_invalid");
  const hours=proposal?.estimated_hours;
  if(!Number.isSafeInteger(hours)||hours<1||hours>168)
    reject("delivery_time_invalid");
  const deadline=task?.deadline;
  if(deadline!=null){
    const due=Date.parse(deadline);
    if(!Number.isFinite(due)||!Number.isSafeInteger(hours)||due<=nowMs+hours*3600000)
      reject("deadline_not_feasible");
  }
  if(existing?.receipt===true||existing?.reservation===true||
     existing?.own_marketplace_bid===true||existing?.uncertain===true)
    reject("existing_bid_or_uncertain_receipt");
  if(delegated!==true)reject("sprite_autonomous_delegation_missing");
  return {
    prebid_feasible:reasons.length===0,
    bid_submitted:false,
    requires_authenticated_single_send:true,
    requires_marketplace_receipt_readback:true,
    requires_post_award_scope_review:true,
    requires_post_award_customer_workspace:true,
    requires_prebid_scope_mapping:false,
    requires_prebid_workspace_attestation:false,
    requires_council_vote:false,
    requires_archived_readiness_row:false,
    funding_risk:noEscrow?"no_escrow_not_guaranteed":
      funded?"reported_funded_not_settlement_guarantee":"unknown",
    reasons
  };
}
